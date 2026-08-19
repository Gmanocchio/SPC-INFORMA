import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { brokers } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { writeAudit } from "./audit";
import { getDb } from "./db";
import { decryptSensitive, encryptSensitive } from "./security";
import { isMessageCenterEndpoint } from "./message-center-adapter";
import { messageCenterCallbackToken } from "./message-center-callback";

export type BrokerChannel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
export type BrokerActor = {
  id: number;
  organizationId: number;
  role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
};

export type BrokerCredentials = Record<string, string>;
export type BrokerExtraConfig = Record<string, string | number | boolean | null>;

type BrokerInput = {
  name: string;
  channel: BrokerChannel;
  endpointUrl: string;
  active: boolean;
  preferred: boolean;
  credentials?: BrokerCredentials;
  extraConfig?: BrokerExtraConfig;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

function assertSpcAdmin(actor: BrokerActor) {
  if (actor.role !== "SPC_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso exclusivo ao Administrador SPC Brasil." });
  }
}

function normalizeCredentials(value: BrokerCredentials | undefined): BrokerCredentials {
  if (!value) return {};
  const entries = Object.entries(value)
    .map(([key, item]) => [key.trim(), item.trim()] as const)
    .filter(([key, item]) => key.length > 0 && item.length > 0);
  return Object.fromEntries(entries);
}

export function assertSafeBrokerEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Endpoint do broker inválido." });
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const privateIpv6 = host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || privateIpv4.test(host) || privateIpv6) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O endpoint deve ser HTTPS público e não pode conter credenciais na URL." });
  }
}

function encryptCredentials(value: BrokerCredentials) {
  if (!ENV.cookieSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Chave de proteção de credenciais indisponível." });
  return encryptSensitive(JSON.stringify(value), ENV.cookieSecret);
}

function decryptCredentials(value: string): BrokerCredentials {
  if (!ENV.cookieSecret) throw new Error("Chave de proteção de credenciais indisponível.");
  const parsed = JSON.parse(decryptSensitive(value, ENV.cookieSecret)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Credenciais do broker em formato inválido.");
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function publicBroker(row: typeof brokers.$inferSelect) {
  let credentialFields: string[] = [];
  try {
    credentialFields = Object.keys(decryptCredentials(row.encryptedCredentials)).sort();
  } catch {
    credentialFields = ["indisponível"];
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    channel: row.channel,
    endpointUrl: row.baseUrl,
    active: row.status === "ACTIVE",
    preferred: row.preferred,
    credentialFields,
    extraConfig: (row.extraConfig ?? {}) as BrokerExtraConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listBrokers(actor: BrokerActor) {
  assertSpcAdmin(actor);
  const db = await requireDb();
  const rows = await db.select().from(brokers).where(eq(brokers.organizationId, actor.organizationId)).orderBy(desc(brokers.preferred), brokers.status, brokers.channel, brokers.name).limit(200);
  return rows.map(publicBroker);
}

export async function createBroker(actor: BrokerActor, input: BrokerInput) {
  assertSpcAdmin(actor);
  assertSafeBrokerEndpoint(input.endpointUrl);
  const credentials = normalizeCredentials(input.credentials);
  if (Object.keys(credentials).length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe ao menos uma credencial protegida." });
  const db = await requireDb();
  let id = 0;
  await db.transaction(async tx => {
    if (input.preferred) {
      await tx.update(brokers).set({ preferred: false }).where(and(eq(brokers.organizationId, actor.organizationId), eq(brokers.channel, input.channel)));
    }
    const result = await tx.insert(brokers).values({
      organizationId: actor.organizationId,
      name: input.name.trim(),
      channel: input.channel,
      baseUrl: input.endpointUrl.trim(),
      encryptedCredentials: encryptCredentials(credentials),
      extraConfig: input.extraConfig ?? {},
      status: input.active ? "ACTIVE" : "INACTIVE",
      preferred: input.preferred,
      createdByUserId: actor.id,
    });
    id = Number(result[0].insertId);
  });
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "BROKER_CREATED", resourceType: "broker", resourceId: String(id), metadata: { channel: input.channel, active: input.active, preferred: input.preferred, credentialFields: Object.keys(credentials) } });
  return { id };
}

export async function updateBroker(actor: BrokerActor, id: number, input: Partial<BrokerInput>) {
  assertSpcAdmin(actor);
  const db = await requireDb();
  const [current] = await db.select().from(brokers).where(and(eq(brokers.id, id), eq(brokers.organizationId, actor.organizationId))).limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Broker não encontrado." });
  if (input.endpointUrl) assertSafeBrokerEndpoint(input.endpointUrl);
  const channel = input.channel ?? current.channel;
  const credentials = input.credentials ? { ...decryptCredentials(current.encryptedCredentials), ...normalizeCredentials(input.credentials) } : null;
  await db.transaction(async tx => {
    if (input.preferred) {
      await tx.update(brokers).set({ preferred: false }).where(and(eq(brokers.organizationId, actor.organizationId), eq(brokers.channel, channel), ne(brokers.id, id)));
    }
    await tx.update(brokers).set({
      name: input.name?.trim(),
      channel: input.channel,
      baseUrl: input.endpointUrl?.trim(),
      encryptedCredentials: credentials && Object.keys(credentials).length > 0 ? encryptCredentials(credentials) : undefined,
      extraConfig: input.extraConfig,
      status: input.active === undefined ? undefined : input.active ? "ACTIVE" : "INACTIVE",
      preferred: input.preferred,
    }).where(and(eq(brokers.id, id), eq(brokers.organizationId, actor.organizationId)));
  });
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "BROKER_UPDATED", resourceType: "broker", resourceId: String(id), metadata: { changedFields: Object.keys(input), channel } });
  return { success: true as const };
}

export async function deactivateBroker(actor: BrokerActor, id: number) {
  assertSpcAdmin(actor);
  const db = await requireDb();
  const result = await db.update(brokers).set({ status: "INACTIVE", preferred: false }).where(and(eq(brokers.id, id), eq(brokers.organizationId, actor.organizationId)));
  if (Number(result[0].affectedRows) !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Broker não encontrado." });
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "BROKER_DEACTIVATED", resourceType: "broker", resourceId: String(id) });
  return { success: true as const };
}

export async function getPreferredBrokerForDispatch(channel: BrokerChannel) {
  const db = await requireDb();
  const [row] = await db.select().from(brokers).where(and(eq(brokers.channel, channel), eq(brokers.status, "ACTIVE"), eq(brokers.preferred, true))).orderBy(desc(brokers.updatedAt)).limit(1);
  return row ? { ...row, credentials: decryptCredentials(row.encryptedCredentials), extraConfig: (row.extraConfig ?? {}) as BrokerExtraConfig } : null;
}

export async function getBrokerForWebhook(id: number) {
  const db = await requireDb();
  const [row] = await db.select().from(brokers).where(and(eq(brokers.id, id), eq(brokers.status, "ACTIVE"))).limit(1);
  return row ? { ...row, credentials: decryptCredentials(row.encryptedCredentials), extraConfig: (row.extraConfig ?? {}) as BrokerExtraConfig } : null;
}

export async function getMessageCenterCallbackConfig(actor: BrokerActor, id: number) {
  assertSpcAdmin(actor);
  const db = await requireDb();
  const [row] = await db.select().from(brokers).where(and(eq(brokers.id, id), eq(brokers.organizationId, actor.organizationId))).limit(1);
  if (!row || !isMessageCenterEndpoint(row.baseUrl)) throw new TRPCError({ code: "NOT_FOUND", message: "Broker Message Center não encontrado no seu escopo." });
  const credentials = decryptCredentials(row.encryptedCredentials);
  if (!credentials.apiKey || !ENV.cookieSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "API key da Message Center indisponível para gerar o callback." });
  const token = messageCenterCallbackToken(row.id, credentials.apiKey, ENV.cookieSecret);
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "BROKER_CALLBACK_URL_VIEWED", resourceType: "broker", resourceId: row.id, metadata: { provider: "MESSAGE_CENTER" } });
  return { path: `/api/webhooks/message-center/${row.id}/${token}`, rotatesWithApiKey: true as const };
}
