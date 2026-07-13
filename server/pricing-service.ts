import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { organizations, pricingRules } from "../drizzle/schema";
import { writeAudit } from "./audit";
import { getDb } from "./db";
import type { Channel, DomainActor } from "./template-service";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export async function listPricing(actor: DomainActor) {
  const db = await requireDb();
  return db.select().from(pricingRules).where(
    actor.role === "SPC_ADMIN"
      ? undefined
      : or(eq(pricingRules.organizationId, actor.organizationId), eq(pricingRules.priceType, "SPC_BASE")),
  ).orderBy(desc(pricingRules.validFrom));
}

export async function setBasePrice(actor: DomainActor, input: { channel: Channel; unitPriceMicros: number; validFrom: Date }) {
  if (actor.role !== "SPC_ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
  const db = await requireDb();
  const id = await db.transaction(async tx => {
    await tx.update(pricingRules).set({ active: false, validUntil: input.validFrom }).where(and(
      eq(pricingRules.organizationId, actor.organizationId),
      eq(pricingRules.channel, input.channel),
      eq(pricingRules.priceType, "SPC_BASE"),
      isNull(pricingRules.creditorOrganizationId),
      eq(pricingRules.active, true),
    ));
    const result = await tx.insert(pricingRules).values({ organizationId: actor.organizationId, creditorOrganizationId: null, channel: input.channel, priceType: "SPC_BASE", unitPriceMicros: input.unitPriceMicros, validFrom: input.validFrom, active: true, createdByUserId: actor.id });
    return Number(result[0].insertId);
  });
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "SPC_BASE_PRICE_SET", resourceType: "pricing_rule", resourceId: id, metadata: { channel: input.channel, unitPriceMicros: input.unitPriceMicros } });
  return { id };
}

async function assertCreditorScope(actor: DomainActor, creditorOrganizationId: number, ownerOrganizationId: number) {
  const db = await requireDb();
  const creditor = await db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId, type: organizations.type, status: organizations.status }).from(organizations).where(eq(organizations.id, creditorOrganizationId)).limit(1);
  if (!creditor[0] || creditor[0].type !== "CREDITOR" || creditor[0].status !== "ACTIVE" || creditor[0].parentOrganizationId !== ownerOrganizationId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });
  }
}

export async function setCreditorPrice(actor: DomainActor, input: { organizationId?: number; creditorOrganizationId: number; channel: Channel; unitPriceMicros: number; validFrom: Date }) {
  if (actor.role === "REQUESTER") throw new TRPCError({ code: "FORBIDDEN" });
  const ownerOrganizationId = actor.role === "SPC_ADMIN" ? input.organizationId : actor.organizationId;
  if (!ownerOrganizationId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a CDL ou Distribuidora responsável." });
  await assertCreditorScope(actor, input.creditorOrganizationId, ownerOrganizationId);
  const db = await requireDb();
  const id = await db.transaction(async tx => {
    await tx.update(pricingRules).set({ active: false, validUntil: input.validFrom }).where(and(
      eq(pricingRules.organizationId, ownerOrganizationId),
      eq(pricingRules.creditorOrganizationId, input.creditorOrganizationId),
      eq(pricingRules.channel, input.channel),
      eq(pricingRules.priceType, "CREDITOR_PRICE"),
      eq(pricingRules.active, true),
    ));
    const result = await tx.insert(pricingRules).values({ organizationId: ownerOrganizationId, creditorOrganizationId: input.creditorOrganizationId, channel: input.channel, priceType: "CREDITOR_PRICE", unitPriceMicros: input.unitPriceMicros, validFrom: input.validFrom, active: true, createdByUserId: actor.id });
    return Number(result[0].insertId);
  });
  await writeAudit({ organizationId: ownerOrganizationId, actorUserId: actor.id, action: "CREDITOR_PRICE_SET", resourceType: "pricing_rule", resourceId: id, metadata: { channel: input.channel, creditorOrganizationId: input.creditorOrganizationId, unitPriceMicros: input.unitPriceMicros } });
  return { id };
}

export async function resolveCampaignPrice(organizationId: number, creditorOrganizationId: number, channel: Channel, isSpcOrganization: boolean) {
  const db = await requireDb();
  const now = new Date();
  const result = await db.select({ unitPriceMicros: pricingRules.unitPriceMicros }).from(pricingRules).where(and(
    eq(pricingRules.organizationId, organizationId),
    isSpcOrganization ? isNull(pricingRules.creditorOrganizationId) : eq(pricingRules.creditorOrganizationId, creditorOrganizationId),
    eq(pricingRules.channel, channel),
    eq(pricingRules.priceType, isSpcOrganization ? "SPC_BASE" : "CREDITOR_PRICE"),
    eq(pricingRules.active, true),
    lte(pricingRules.validFrom, now),
    or(isNull(pricingRules.validUntil), gt(pricingRules.validUntil, now)),
  )).orderBy(desc(pricingRules.validFrom)).limit(1);
  if (!result[0] || result[0].unitPriceMicros < 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Não existe preço vigente para ${channel} neste credor.` });
  }
  return result[0].unitPriceMicros;
}
