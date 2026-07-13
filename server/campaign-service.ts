import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import {
  campaignRecipients,
  campaigns,
  financialLedger,
  messageTemplates,
  organizations,
  uploads,
} from "../drizzle/schema";
import { writeAudit } from "./audit";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { resolveCampaignPrice } from "./pricing-service";
import { encryptSensitive, hmacToken, sha256 } from "./security";
import { storagePut } from "./storage";
import type { Channel, DomainActor } from "./template-service";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;
const acceptedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  if (!ENV.cookieSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Criptografia do servidor indisponível." });
  return db;
}

function safeFilename(value: string) {
  return basename(value).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 255) || "importacao";
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseRows(buffer: Buffer, mimeType: string, filename: string) {
  const isXlsx = mimeType.includes("spreadsheetml") || filename.toLowerCase().endsWith(".xlsx");
  if (isXlsx) {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new TRPCError({ code: "BAD_REQUEST", message: "Assinatura XLSX inválida." });
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!firstSheet) throw new TRPCError({ code: "BAD_REQUEST", message: "A planilha não possui uma aba legível." });
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
  }
  if (buffer.includes(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo CSV contém dados binários inválidos." });
  return parseCsv(buffer.toString("utf8"), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: false, trim: true }) as Record<string, unknown>[];
}

function normalizeTarget(channel: Channel, row: Record<string, unknown>) {
  const entries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()] as const);
  const normalized = Object.fromEntries(entries);
  const raw = channel === "EMAIL"
    ? normalized.email ?? normalized.destinatario ?? ""
    : normalized.telefone ?? normalized.celular ?? normalized.phone ?? normalized.destinatario ?? "";
  if (channel === "EMAIL") {
    const target = raw.toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(target) && target.length <= 320;
    return { target, valid, error: valid ? null : "E-mail inválido ou ausente." };
  }
  const target = raw.replace(/\D/g, "");
  const valid = target.length >= 10 && target.length <= 13;
  return { target, valid, error: valid ? null : "Telefone inválido ou ausente." };
}

function sanitizePayload(row: Record<string, unknown>) {
  const payload: Record<string, string> = Object.create(null);
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = normalizeHeader(rawKey);
    if (!key || ["__proto__", "prototype", "constructor"].includes(key)) continue;
    payload[key] = String(rawValue ?? "").trim().slice(0, 500);
  }
  const serialized = JSON.stringify(payload);
  if (serialized.length > 12_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma das linhas excede o limite de dados permitido." });
  return serialized;
}

async function resolveCampaignOrganization(actor: DomainActor, requested?: number) {
  const db = await requireDb();
  const organizationId = actor.role === "SPC_ADMIN" ? requested ?? actor.organizationId : actor.organizationId;
  const result = await db.select().from(organizations).where(and(eq(organizations.id, organizationId), eq(organizations.status, "ACTIVE"))).limit(1);
  if (!result[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Organização inválida ou inativa." });
  return result[0];
}

async function assertCreditorAndTemplate(organizationId: number, creditorOrganizationId: number, templateId: number, channel: Channel, isSpc: boolean) {
  const db = await requireDb();
  const [creditor] = await db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId, type: organizations.type, status: organizations.status }).from(organizations).where(eq(organizations.id, creditorOrganizationId)).limit(1);
  if (!creditor || creditor.type !== "CREDITOR" || creditor.status !== "ACTIVE" || (!isSpc && creditor.parentOrganizationId !== organizationId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });
  }
  const [template] = await db.select().from(messageTemplates).where(and(eq(messageTemplates.id, templateId), eq(messageTemplates.status, "ACTIVE"), eq(messageTemplates.channel, channel))).limit(1);
  if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Template ativo incompatível com o canal selecionado." });
}

export function campaignImportLayout(channel: Channel) {
  const target = channel === "EMAIL" ? "email" : "telefone";
  return { filename: `modelo-notificadora-${channel.toLowerCase()}.csv`, columns: [target, "nome", "documento", "valor", "data_vencimento"], separator: ";", encoding: "UTF-8" };
}

export async function listCampaignOptions(actor: DomainActor) {
  const db = await requireDb();
  const scope = actor.role === "SPC_ADMIN"
    ? eq(organizations.status, "ACTIVE")
    : and(
        eq(organizations.status, "ACTIVE"),
        or(eq(organizations.id, actor.organizationId), eq(organizations.parentOrganizationId, actor.organizationId)),
      );
  const rows = await db.select({
    id: organizations.id,
    tradeName: organizations.tradeName,
    type: organizations.type,
    parentOrganizationId: organizations.parentOrganizationId,
    billingModel: organizations.billingModel,
    balanceCents: organizations.balanceCents,
  }).from(organizations).where(scope).orderBy(organizations.tradeName).limit(1000);
  return {
    owners: rows.filter(item => item.type !== "CREDITOR"),
    creditors: rows.filter(item => item.type === "CREDITOR"),
  };
}

export async function createCampaignFromFile(actor: DomainActor, input: {
  organizationId?: number;
  creditorOrganizationId: number;
  templateId: number;
  name: string;
  channel: Channel;
  filename: string;
  mimeType: string;
  base64: string;
  scheduledFor?: Date | null;
  idempotencyKey: string;
}) {
  if (!acceptedMimeTypes.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato não permitido. Utilize CSV ou XLSX." });
  const file = Buffer.from(input.base64, "base64");
  if (!file.length || file.length > MAX_FILE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo deve possuir até 8 MB." });
  const organization = await resolveCampaignOrganization(actor, input.organizationId);
  const isSpc = organization.type === "SPC_BRASIL";
  await assertCreditorAndTemplate(organization.id, input.creditorOrganizationId, input.templateId, input.channel, isSpc);
  const unitPriceMicros = await resolveCampaignPrice(organization.id, input.creditorOrganizationId, input.channel, isSpc);
  const campaignId = randomUUID();
  const idempotencyKey = hmacToken(`${organization.id}:${input.idempotencyKey}`, ENV.cookieSecret);
  const rows = parseRows(file, input.mimeType, input.filename);
  if (!rows.length || rows.length > MAX_ROWS) throw new TRPCError({ code: "BAD_REQUEST", message: `O arquivo deve conter entre 1 e ${MAX_ROWS.toLocaleString("pt-BR")} linhas.` });
  const normalizedRows = rows.map((row, index) => {
    const { target, valid, error } = normalizeTarget(input.channel, row);
    const fallback = target || `linha-${index + 2}`;
    return {
      campaignId,
      organizationId: organization.id,
      destinationCiphertext: encryptSensitive(fallback, ENV.cookieSecret),
      destinationFingerprint: hmacToken(`${organization.id}:${input.channel}:${fallback}`, ENV.cookieSecret),
      variablesCiphertext: encryptSensitive(sanitizePayload(row), ENV.cookieSecret),
      status: valid ? "PENDING" as const : "INVALID" as const,
      errorCode: valid ? null : `ROW_${index + 2}:INVALID_TARGET`,
      validationError: error,
      rowNumber: index + 2,
    };
  });
  const validRows = normalizedRows.filter(row => row.status === "PENDING").length;
  const invalidRows = normalizedRows.length - validRows;
  const totalAmountCents = calculateCampaignAmountCents(validRows, unitPriceMicros);
  const cleanFilename = safeFilename(input.filename);
  const fileHash = sha256(file.toString("base64"));
  const stored = await storagePut(`campaign-imports/${organization.id}/${campaignId}/${cleanFilename}`, file, input.mimeType);
  const db = await requireDb();
  const uploadId = randomUUID();
  const validationErrors = normalizedRows
    .filter(row => row.status === "INVALID")
    .slice(0, 500)
    .map(row => ({ rowNumber: row.rowNumber, errorCode: "INVALID_TARGET", message: row.validationError }));
  try {
    await db.transaction(async tx => {
      const duplicate = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.idempotencyKey, idempotencyKey)).limit(1);
      if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "Esta importação já foi processada." });
      await tx.insert(uploads).values({
        id: uploadId,
        organizationId: organization.id,
        createdByUserId: actor.id,
        originalName: cleanFilename,
        storageKey: stored.key,
        mimeType: input.mimeType,
        sizeBytes: file.length,
        sha256: fileHash,
        status: validRows ? "VALID" : "INVALID",
        validationSummary: {
          totalRows: normalizedRows.length,
          validRows,
          invalidRows,
          errors: validationErrors,
        },
      });
      await tx.insert(campaigns).values({
        id: campaignId,
        organizationId: organization.id,
        creditorOrganizationId: input.creditorOrganizationId,
        createdByUserId: actor.id,
        templateId: input.templateId,
        uploadId,
        name: input.name.trim(),
        channel: input.channel,
        status: validRows ? "READY" : "FAILED",
        billingModelSnapshot: organization.billingModel,
        scheduledFor: input.scheduledFor ?? null,
        recipientCount: normalizedRows.length,
        validRecipientCount: validRows,
        invalidRecipientCount: invalidRows,
        unitPriceMicros,
        totalCostMicros: validRows * unitPriceMicros,
        idempotencyKey,
      });
      for (let index = 0; index < normalizedRows.length; index += 500) {
        await tx.insert(campaignRecipients).values(
          normalizedRows.slice(index, index + 500).map(({ validationError: _error, rowNumber: _row, ...recipient }) => recipient),
        );
      }
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (String(error).includes("campaigns_idempotency_key_uq")) throw new TRPCError({ code: "CONFLICT", message: "Esta importação já foi processada." });
    throw error;
  }
  await writeAudit({ organizationId: organization.id, actorUserId: actor.id, action: "CAMPAIGN_IMPORTED", resourceType: "campaign", resourceId: campaignId, metadata: { channel: input.channel, totalRows: normalizedRows.length, validRows, invalidRows, totalAmountCents } });
  return {
    id: campaignId,
    status: validRows ? "READY" as const : "FAILED" as const,
    totalRows: normalizedRows.length,
    validRows,
    invalidRows,
    unitPriceMicros,
    totalAmountCents,
    errors: validationErrors,
    errorsTruncated: invalidRows > validationErrors.length,
  };
}

function campaignScope(actor: DomainActor) {
  return actor.role === "SPC_ADMIN" ? undefined : eq(campaigns.organizationId, actor.organizationId);
}

export async function listCampaigns(actor: DomainActor) {
  const db = await requireDb();
  return db.select({
    id: campaigns.id,
    name: campaigns.name,
    channel: campaigns.channel,
    status: campaigns.status,
    organizationId: campaigns.organizationId,
    creditorOrganizationId: campaigns.creditorOrganizationId,
    scheduledFor: campaigns.scheduledFor,
    totalRecipients: campaigns.recipientCount,
    validRecipients: campaigns.validRecipientCount,
    invalidRecipients: campaigns.invalidRecipientCount,
    deliveredRecipients: campaigns.deliveredCount,
    unitPriceMicros: campaigns.unitPriceMicros,
    totalCostMicros: campaigns.totalCostMicros,
    createdAt: campaigns.createdAt,
  }).from(campaigns).where(campaignScope(actor)).orderBy(desc(campaigns.createdAt)).limit(200);
}

export async function campaignDetails(actor: DomainActor, id: string) {
  const db = await requireDb();
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), campaignScope(actor))).limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada no seu escopo." });
  const [upload] = campaign.uploadId
    ? await db.select({ validationSummary: uploads.validationSummary }).from(uploads).where(and(eq(uploads.id, campaign.uploadId), eq(uploads.organizationId, campaign.organizationId))).limit(1)
    : [];
  const summary = upload?.validationSummary as { errors?: Array<{ rowNumber: number; errorCode: string; message: string | null }> } | null | undefined;
  const errors = summary?.errors ?? [];
  return { campaign, errors };
}

export async function confirmCampaign(actor: DomainActor, id: string, confirmed: boolean) {
  if (!confirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "A confirmação explícita é obrigatória." });
  const db = await requireDb();
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), campaignScope(actor))).limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada no seu escopo." });
  if (["QUEUED", "SCHEDULED", "PROCESSING", "COMPLETED"].includes(campaign.status)) {
    return { success: true as const, status: campaign.status, idempotent: true as const };
  }
  if (campaign.status !== "READY" || campaign.validRecipientCount < 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A campanha não está pronta para confirmação." });
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, campaign.organizationId)).limit(1);
  if (!organization) throw new TRPCError({ code: "NOT_FOUND", message: "Organização da campanha não encontrada." });
  const scheduled = Boolean(campaign.scheduledFor && campaign.scheduledFor.getTime() > Date.now() + 60_000);
  const nextStatus = scheduled ? "SCHEDULED" as const : "QUEUED" as const;
  const amount = calculateCampaignAmountCents(campaign.validRecipientCount, campaign.unitPriceMicros);
  let balanceAfter = calculateBalanceAfterConfirmation({
    billingModel: organization.billingModel,
    balanceCents: organization.balanceCents,
    creditLimitCents: organization.creditLimitCents,
    amountCents: amount,
  });
  await db.transaction(async tx => {
    if (organization.billingModel === "PREPAID") {
      const [header] = await tx.update(organizations).set({ balanceCents: sql`${organizations.balanceCents} - ${amount}` }).where(and(eq(organizations.id, organization.id), gte(organizations.balanceCents, amount)));
      if (Number(header.affectedRows) !== 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Saldo pré-pago insuficiente para confirmar a campanha." });
    } else {
      await tx.update(organizations).set({ balanceCents: sql`${organizations.balanceCents} + ${amount}` }).where(eq(organizations.id, organization.id));
    }
    const [header] = await tx.update(campaigns).set({ status: nextStatus, confirmedAt: new Date() }).where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "READY")));
    if (Number(header.affectedRows) !== 1) throw new TRPCError({ code: "CONFLICT", message: "A campanha foi alterada por outra operação." });
    await tx.insert(financialLedger).values({
      organizationId: organization.id,
      campaignId: campaign.id,
      type: organization.billingModel === "PREPAID" ? "RESERVE" : "DEBIT",
      amountMicros: campaign.totalCostMicros,
      balanceAfterMicros: balanceAfter * 10_000,
      description: `Confirmação financeira da campanha ${campaign.name}`,
      idempotencyKey: `campaign:${campaign.id}:confirm`,
      createdByUserId: actor.id,
    });
  });
  await writeAudit({ organizationId: campaign.organizationId, actorUserId: actor.id, action: "CAMPAIGN_CONFIRMED", resourceType: "campaign", resourceId: campaign.id, metadata: { status: nextStatus, amountCents: amount, billingModel: organization.billingModel } });
  return { success: true as const, status: nextStatus, idempotent: false as const };
}

export function calculateCampaignAmountCents(validRecipients: number, unitPriceMicros: number) {
  if (!Number.isSafeInteger(validRecipients) || validRecipients < 0 || !Number.isSafeInteger(unitPriceMicros) || unitPriceMicros < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Quantidade ou preço inválido." });
  }
  return Math.ceil((validRecipients * unitPriceMicros) / 10_000);
}

export function calculateBalanceAfterConfirmation(input: {
  billingModel: "PREPAID" | "POSTPAID";
  balanceCents: number;
  creditLimitCents: number;
  amountCents: number;
}) {
  const { billingModel, balanceCents, creditLimitCents, amountCents } = input;
  if (billingModel === "PREPAID") {
    if (balanceCents < amountCents) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Saldo pré-pago insuficiente para confirmar a campanha." });
    }
    return balanceCents - amountCents;
  }
  const nextBalance = balanceCents + amountCents;
  if (creditLimitCents > 0 && nextBalance > creditLimitCents) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O limite pós-pago seria excedido por esta campanha." });
  }
  return nextBalance;
}
