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
import {
  CAMPAIGN_IMPORT_COLUMNS,
  formatDebtAmountCents,
  formatDebtDueDate,
  TEMPLATE_VARIABLES,
  type TemplateVariableKey,
} from "../shared/template-variables";
import { writeAudit } from "./audit";
import { isValidCpf, normalizeCpf, normalizePhone } from "./br-validation";
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
  "text/plain",
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

function detectDelimiter(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return commaCount > semicolonCount ? "," : ";";
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
  if (buffer.includes(0)) throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo contém dados binários inválidos." });
  const text = buffer.toString("utf8");
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  return parseCsv(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: false, trim: true, delimiter }) as Record<string, unknown>[];
}

function parseAmount(value: string) {
  const compact = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!compact || !/^-?[\d.,]+$/.test(compact)) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalSeparator = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot ? "," : "."
    : lastComma >= 0
      ? ","
      : lastDot >= 0 && compact.length - lastDot - 1 <= 2
        ? "."
        : null;
  const normalized = decimalSeparator
    ? `${compact.slice(0, compact.lastIndexOf(decimalSeparator)).replace(/[.,]/g, "")}.${compact.slice(compact.lastIndexOf(decimalSeparator) + 1)}`
    : compact.replace(/[.,]/g, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function parseDueDate(value: string) {
  const trimmed = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const year = Number(br?.[3] ?? iso?.[1]);
  const month = Number(br?.[2] ?? iso?.[2]);
  const day = Number(br?.[1] ?? iso?.[3]);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function assertCampaignImportColumns(row: Record<string, unknown>) {
  const actual = Object.keys(row).map((column, index) => column.trim().replace(index === 0 ? /^\uFEFF/ : /$^/, ""));
  const expected = [...CAMPAIGN_IMPORT_COLUMNS];
  const missing = expected.filter(column => !actual.includes(column));
  const extra = actual.filter(column => !expected.includes(column as (typeof CAMPAIGN_IMPORT_COLUMNS)[number]));
  const orderChanged = !missing.length && !extra.length && actual.some((column, index) => column !== expected[index]);
  if (!missing.length && !extra.length && !orderChanged) return;
  const details = [
    missing.length ? `faltando: ${missing.join(", ")}` : null,
    extra.length ? `não permitidas: ${extra.join(", ")}` : null,
    orderChanged ? "ordem das colunas diferente do modelo" : null,
  ].filter(Boolean).join("; ");
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Layout inválido (${details}). Baixe o modelo padrão e mantenha exatamente as nove colunas.`,
  });
}

function normalizeCreditorPhones(value: string) {
  const parts = value.split(/[;,|/]+/).map(item => normalizePhone(item) ?? "").filter(Boolean);
  if (!parts.length || parts.length > 5 || parts.some(item => item.length < 10 || item.length > 13)) return null;
  return parts.join(" / ");
}

function normalizeLink(value: string) {
  try {
    const link = new URL(value.trim());
    if (!new Set(["http:", "https:"]).has(link.protocol) || link.toString().length > 2048) return null;
    return link.toString();
  } catch {
    return null;
  }
}

export function normalizeCampaignImportRow(row: Record<string, unknown>) {
  const source = Object.fromEntries(TEMPLATE_VARIABLES.map(variable => [variable.key, String(row[variable.column] ?? "").trim()])) as Record<TemplateVariableKey, string>;
  const cpf = normalizeCpf(source.cpf);
  const customerName = source.nome_cliente.replace(/\s+/g, " ").slice(0, 160);
  const creditorName = source.nome_credor.replace(/\s+/g, " ").slice(0, 160);
  const amountCents = parseAmount(source.valor);
  const dueDate = parseDueDate(source.data_vencimento);
  const contractNumber = source.numero_contrato.slice(0, 120);
  const creditorPhone = normalizeCreditorPhones(source.telefone_credor);
  const creditorEmail = source.email_credor.toLowerCase().slice(0, 320);
  const link = normalizeLink(source.link);
  const errors: Array<{ code: string; message: string }> = [];
  if (!isValidCpf(cpf)) errors.push({ code: "INVALID_CPF", message: "CPF inválido ou ausente." });
  if (!customerName) errors.push({ code: "INVALID_CUSTOMER_NAME", message: "Nome do cliente ausente." });
  if (!creditorName) errors.push({ code: "INVALID_CREDITOR_NAME", message: "Nome do credor ausente." });
  if (amountCents === null) errors.push({ code: "INVALID_AMOUNT", message: "Valor inválido ou ausente." });
  if (!dueDate) errors.push({ code: "INVALID_DUE_DATE", message: "Data de vencimento inválida. Use DD/MM/AAAA." });
  if (!contractNumber) errors.push({ code: "INVALID_CONTRACT_NUMBER", message: "Número do contrato ausente." });
  if (!creditorPhone) errors.push({ code: "INVALID_CREDITOR_PHONE", message: "Telefone do credor inválido ou ausente." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(creditorEmail)) errors.push({ code: "INVALID_CREDITOR_EMAIL", message: "E-mail do credor inválido ou ausente." });
  if (!link) errors.push({ code: "INVALID_LINK", message: "Link inválido ou ausente. Use um endereço HTTP ou HTTPS." });
  const variables: Record<TemplateVariableKey, string> = {
    cpf,
    nome_cliente: customerName,
    nome_credor: creditorName,
    valor: amountCents === null ? "" : formatDebtAmountCents(amountCents),
    data_vencimento: dueDate ? formatDebtDueDate(dueDate) : "",
    numero_contrato: contractNumber,
    telefone_credor: creditorPhone ?? "",
    email_credor: creditorEmail,
    link: link ?? "",
  };
  return { cpf, customerName, creditorName, amountCents, dueDate, contractNumber, creditorPhone: creditorPhone ?? "", creditorEmail, link: link ?? "", variables, errors };
}

export function campaignRecipientPersistenceValues(normalized: ReturnType<typeof normalizeCampaignImportRow>) {
  return {
    cpf: normalized.cpf,
    customerName: normalized.customerName,
    creditorName: normalized.creditorName,
    amountCents: normalized.amountCents,
    dueDate: normalized.dueDate,
    contractNumber: normalized.contractNumber,
    creditorPhone: normalized.creditorPhone,
    creditorEmail: normalized.creditorEmail,
    link: normalized.link,
  };
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
  const [creditor] = await db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId, linkedToOrganizationId: organizations.linkedToOrganizationId, type: organizations.type, status: organizations.status }).from(organizations).where(eq(organizations.id, creditorOrganizationId)).limit(1);
  if (!creditor || creditor.type !== "CREDITOR" || creditor.status !== "ACTIVE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });
  }
  const creditorOwnerId = creditor.linkedToOrganizationId ?? creditor.parentOrganizationId;
  // Usuário credor só opera o próprio cadastro; CDL/Distribuidora só opera credores vinculados ao seu escopo.
  if (!isSpc && creditor.id !== organizationId && creditorOwnerId !== organizationId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });
  }
  const [template] = await db.select().from(messageTemplates).where(and(eq(messageTemplates.id, templateId), eq(messageTemplates.status, "ACTIVE"), eq(messageTemplates.channel, channel))).limit(1);
  if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Template ativo incompatível com o canal selecionado." });
  return template;
}

export function campaignTemplateSnapshotValues(template: typeof messageTemplates.$inferSelect) {
  return {
    templateNameSnapshot: template.name,
    templateVersionSnapshot: template.version,
    templateSubjectSnapshot: template.subject,
    templateContentSnapshot: template.content,
    templateVariablesSnapshot: template.variables,
  };
}

export function campaignImportLayout(_channel: Channel) {
  return { filename: "modelo-notificadora-spc.csv", columns: [...CAMPAIGN_IMPORT_COLUMNS], separator: ";", encoding: "UTF-8" };
}

export async function listCampaignOptions(actor: DomainActor) {
  const db = await requireDb();
  const scope = actor.role === "SPC_ADMIN"
    ? eq(organizations.status, "ACTIVE")
    : and(
        eq(organizations.status, "ACTIVE"),
        or(eq(organizations.id, actor.organizationId), eq(organizations.linkedToOrganizationId, actor.organizationId), eq(organizations.parentOrganizationId, actor.organizationId)),
      );
  const rows = await db.select({
    id: organizations.id,
    tradeName: organizations.tradeName,
    type: organizations.type,
    parentOrganizationId: organizations.parentOrganizationId,
    linkedToOrganizationId: organizations.linkedToOrganizationId,
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
  const template = await assertCreditorAndTemplate(organization.id, input.creditorOrganizationId, input.templateId, input.channel, isSpc);
  const unitPriceMicros = await resolveCampaignPrice(organization.id, input.creditorOrganizationId, input.channel);
  const campaignId = randomUUID();
  const idempotencyKey = hmacToken(`${organization.id}:${input.idempotencyKey}`, ENV.cookieSecret);
  const rows = parseRows(file, input.mimeType, input.filename);
  if (!rows.length || rows.length > MAX_ROWS) throw new TRPCError({ code: "BAD_REQUEST", message: `O arquivo deve conter entre 1 e ${MAX_ROWS.toLocaleString("pt-BR")} linhas.` });
  assertCampaignImportColumns(rows[0]);
  const normalizedRows = rows.map((row, index) => {
    const normalized = normalizeCampaignImportRow(row);
    const persisted = campaignRecipientPersistenceValues(normalized);
    const valid = normalized.errors.length === 0;
    const fallback = persisted.cpf || `linha-${index + 2}`;
    return {
      campaignId,
      organizationId: organization.id,
      destinationCiphertext: encryptSensitive(fallback, ENV.cookieSecret),
      destinationFingerprint: hmacToken(`${organization.id}:${input.channel}:${fallback}`, ENV.cookieSecret),
      variablesCiphertext: encryptSensitive(JSON.stringify(normalized.variables), ENV.cookieSecret),
      cpfCiphertext: encryptSensitive(persisted.cpf || "[inválido]", ENV.cookieSecret),
      customerNameCiphertext: encryptSensitive(persisted.customerName || "[inválido]", ENV.cookieSecret),
      creditorNameCiphertext: encryptSensitive(persisted.creditorName || "[inválido]", ENV.cookieSecret),
      amountCents: persisted.amountCents,
      dueDate: persisted.dueDate,
      contractNumberCiphertext: encryptSensitive(persisted.contractNumber || "[inválido]", ENV.cookieSecret),
      creditorPhoneCiphertext: encryptSensitive(persisted.creditorPhone || "[inválido]", ENV.cookieSecret),
      creditorEmailCiphertext: encryptSensitive(persisted.creditorEmail || "[inválido]", ENV.cookieSecret),
      linkCiphertext: encryptSensitive(persisted.link || "[inválido]", ENV.cookieSecret),
      status: valid ? "PENDING" as const : "INVALID" as const,
      errorCode: valid ? null : `ROW_${index + 2}:${normalized.errors[0]?.code ?? "INVALID_ROW"}`,
      validationCode: normalized.errors[0]?.code ?? "INVALID_ROW",
      validationError: normalized.errors.map(error => error.message).join(" "),
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
    .map(row => ({ rowNumber: row.rowNumber, errorCode: row.validationCode, message: row.validationError }));
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
        ...campaignTemplateSnapshotValues(template),
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
          normalizedRows.slice(index, index + 500).map(({ validationCode: _code, validationError: _error, rowNumber: _row, ...recipient }) => recipient),
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

const EDITABLE_CAMPAIGN_STATUSES = new Set(["DRAFT", "UPLOADING", "VALIDATING", "READY", "FAILED"]);

export function assertCampaignEditable(status: string) {
  if (!EDITABLE_CAMPAIGN_STATUSES.has(status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "A campanha não pode ser editada após a confirmação ou o início do processamento.",
    });
  }
}

export async function updateCampaign(actor: DomainActor, id: string, input: { name?: string; scheduledFor?: Date | null }) {
  if (actor.role === "REQUESTER") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar campanhas." });
  const db = await requireDb();
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), campaignScope(actor))).limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada no seu escopo." });
  assertCampaignEditable(campaign.status);
  if (input.scheduledFor && input.scheduledFor.getTime() <= Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O agendamento deve ser definido para uma data futura." });
  }
  const changes = {
    name: input.name?.trim(),
    scheduledFor: input.scheduledFor,
  };
  const [header] = await db.update(campaigns).set(changes).where(and(eq(campaigns.id, id), eq(campaigns.status, campaign.status)));
  if (Number(header.affectedRows) !== 1) throw new TRPCError({ code: "CONFLICT", message: "A campanha foi alterada por outra operação." });
  await writeAudit({
    organizationId: campaign.organizationId,
    actorUserId: actor.id,
    action: "CAMPAIGN_UPDATED",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: { changedFields: Object.keys(input), previousStatus: campaign.status },
  });
  return { success: true as const };
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

export async function deleteCampaign(actor: DomainActor, id: string) {
  if (actor.role === "REQUESTER") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem deletar campanhas." });
  const db = await requireDb();
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), campaignScope(actor))).limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada no seu escopo." });
  assertCampaignEditable(campaign.status);
  
  // Delete related recipients first
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, id));
  
  // Delete the campaign
  const [result] = await db.delete(campaigns).where(eq(campaigns.id, id));
  if (Number(result.affectedRows) !== 1) throw new TRPCError({ code: "CONFLICT", message: "A campanha foi alterada por outra operação." });
  
  await writeAudit({
    organizationId: campaign.organizationId,
    actorUserId: actor.id,
    action: "CAMPAIGN_DELETED",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: { previousStatus: campaign.status },
  });
  
  return { success: true as const };
}
