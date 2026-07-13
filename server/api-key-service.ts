import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { apiKeys, organizations } from "../drizzle/schema";
import { writeAudit } from "./audit";
import { getDb } from "./db";
import { createOpaqueToken, sha256 } from "./security";
import type { DomainActor } from "./template-service";

const allowedScopes = new Set(["campaigns:read", "campaigns:write", "reports:read"]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

async function resolveOrganizationId(actor: DomainActor, requested?: number) {
  const organizationId = actor.role === "SPC_ADMIN" ? requested ?? actor.organizationId : actor.organizationId;
  const db = await requireDb();
  const target = await db.select({ id: organizations.id, status: organizations.status }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!target[0] || target[0].status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Organização inválida ou inativa." });
  return organizationId;
}

export async function listApiKeys(actor: DomainActor, requestedOrganizationId?: number) {
  const organizationId = await resolveOrganizationId(actor, requestedOrganizationId);
  const db = await requireDb();
  return db.select({ id: apiKeys.id, organizationId: apiKeys.organizationId, name: apiKeys.name, prefix: apiKeys.prefix, lastFour: apiKeys.lastFour, scopes: apiKeys.scopes, expiresAt: apiKeys.expiresAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.organizationId, organizationId)).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(actor: DomainActor, input: { organizationId?: number; name: string; scopes: string[]; expiresAt?: Date | null }) {
  const organizationId = await resolveOrganizationId(actor, input.organizationId);
  const uniqueScopes = Array.from(new Set(input.scopes));
  if (!uniqueScopes.length || uniqueScopes.some(scope => !allowedScopes.has(scope))) throw new TRPCError({ code: "BAD_REQUEST", message: "Escopos de API inválidos." });
  if (input.expiresAt && input.expiresAt <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "A expiração deve estar no futuro." });
  const db = await requireDb();
  const active = await db.select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt))).limit(11);
  if (active.length >= 10) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Limite de 10 chaves ativas atingido. Revogue uma chave antes de continuar." });
  const prefix = createOpaqueToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  const rawKey = `ntf_${prefix}_${createOpaqueToken(32)}`;
  const result = await db.insert(apiKeys).values({ organizationId, name: input.name.trim(), prefix, lastFour: rawKey.slice(-4), secretHash: sha256(rawKey), scopes: uniqueScopes, expiresAt: input.expiresAt ?? null, createdByUserId: actor.id });
  const id = Number(result[0].insertId);
  await writeAudit({ organizationId, actorUserId: actor.id, action: "API_KEY_CREATED", resourceType: "api_key", resourceId: id, metadata: { name: input.name, scopes: uniqueScopes, expiresAt: input.expiresAt?.toISOString() ?? null } });
  return { id, key: rawKey, displayedOnce: true as const };
}

export async function rotateApiKey(actor: DomainActor, id: number, input: { name: string; scopes: string[]; expiresAt?: Date | null }) {
  const uniqueScopes = Array.from(new Set(input.scopes));
  if (!uniqueScopes.length || uniqueScopes.some(scope => !allowedScopes.has(scope))) throw new TRPCError({ code: "BAD_REQUEST", message: "Escopos de API inválidos." });
  if (input.expiresAt && input.expiresAt <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "A expiração deve estar no futuro." });
  const db = await requireDb();
  const current = await db.select({ id: apiKeys.id, organizationId: apiKeys.organizationId, revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!current[0] || (actor.role !== "SPC_ADMIN" && current[0].organizationId !== actor.organizationId)) throw new TRPCError({ code: "NOT_FOUND", message: "Chave não encontrada no seu escopo." });
  if (current[0].revokedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Uma chave revogada não pode ser substituída." });
  await resolveOrganizationId(actor, current[0].organizationId);
  const prefix = createOpaqueToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  const rawKey = `ntf_${prefix}_${createOpaqueToken(32)}`;
  const now = new Date();
  const newId = await db.transaction(async tx => {
    await tx.update(apiKeys).set({ revokedAt: now }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
    const result = await tx.insert(apiKeys).values({ organizationId: current[0].organizationId, name: input.name.trim(), prefix, lastFour: rawKey.slice(-4), secretHash: sha256(rawKey), scopes: uniqueScopes, expiresAt: input.expiresAt ?? null, createdByUserId: actor.id });
    return Number(result[0].insertId);
  });
  await writeAudit({ organizationId: current[0].organizationId, actorUserId: actor.id, action: "API_KEY_ROTATED", resourceType: "api_key", resourceId: newId, metadata: { replacedApiKeyId: id, name: input.name, scopes: uniqueScopes, expiresAt: input.expiresAt?.toISOString() ?? null } });
  return { id: newId, key: rawKey, displayedOnce: true as const, replacedApiKeyId: id };
}

export async function revokeApiKey(actor: DomainActor, id: number) {
  const db = await requireDb();
  const key = await db.select({ id: apiKeys.id, organizationId: apiKeys.organizationId, revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!key[0] || (actor.role !== "SPC_ADMIN" && key[0].organizationId !== actor.organizationId)) throw new TRPCError({ code: "NOT_FOUND", message: "Chave não encontrada no seu escopo." });
  if (!key[0].revokedAt) await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  await writeAudit({ organizationId: key[0].organizationId, actorUserId: actor.id, action: "API_KEY_REVOKED", resourceType: "api_key", resourceId: id });
  return { success: true as const };
}
