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

export type CampaignPricingOrganization = {
  id: number;
  type: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  parentOrganizationId: number | null;
  linkedToOrganizationId: number | null;
};

type CampaignPricingTargetInput = {
  responsibleOrganization: CampaignPricingOrganization;
  creditorOrganization: CampaignPricingOrganization;
  spcOrganization: CampaignPricingOrganization;
  linkedOrganization: CampaignPricingOrganization | null;
};

export function determineCampaignPricingTarget(input: CampaignPricingTargetInput) {
  const { responsibleOrganization, creditorOrganization, spcOrganization, linkedOrganization } = input;
  const invalidCreditor = () => new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });

  if (
    responsibleOrganization.status !== "ACTIVE"
    || creditorOrganization.status !== "ACTIVE"
    || creditorOrganization.type !== "CREDITOR"
    || spcOrganization.status !== "ACTIVE"
    || spcOrganization.type !== "SPC_BRASIL"
  ) {
    throw invalidCreditor();
  }

  const creditorOwnerId = creditorOrganization.linkedToOrganizationId ?? creditorOrganization.parentOrganizationId;

  if (responsibleOrganization.type === "SPC_BRASIL") {
    if (creditorOwnerId !== null && creditorOwnerId !== responsibleOrganization.id) throw invalidCreditor();
    return {
      priceOwnerOrganizationId: responsibleOrganization.id,
      creditorOrganizationId: null,
      priceType: "SPC_BASE" as const,
    };
  }

  if (responsibleOrganization.type === "CDL" || responsibleOrganization.type === "DISTRIBUTOR") {
    if (creditorOwnerId !== responsibleOrganization.id) throw invalidCreditor();
    return {
      priceOwnerOrganizationId: responsibleOrganization.id,
      creditorOrganizationId: creditorOrganization.id,
      priceType: "CREDITOR_PRICE" as const,
    };
  }

  if (responsibleOrganization.id !== creditorOrganization.id) throw invalidCreditor();

  const responsibleOwnerId = responsibleOrganization.linkedToOrganizationId ?? responsibleOrganization.parentOrganizationId;
  if (responsibleOwnerId === null) {
    return {
      priceOwnerOrganizationId: spcOrganization.id,
      creditorOrganizationId: null,
      priceType: "SPC_BASE" as const,
    };
  }

  if (!linkedOrganization || linkedOrganization.id !== responsibleOwnerId || linkedOrganization.status !== "ACTIVE") {
    throw invalidCreditor();
  }

  if (linkedOrganization.type === "SPC_BRASIL") {
    return {
      priceOwnerOrganizationId: linkedOrganization.id,
      creditorOrganizationId: null,
      priceType: "SPC_BASE" as const,
    };
  }

  if (linkedOrganization.type === "CDL" || linkedOrganization.type === "DISTRIBUTOR") {
    return {
      priceOwnerOrganizationId: linkedOrganization.id,
      creditorOrganizationId: creditorOrganization.id,
      priceType: "CREDITOR_PRICE" as const,
    };
  }

  throw invalidCreditor();
}

export async function listPricingOrganizations(actor: DomainActor) {
  const db = await requireDb();
  // Para Precificacao: retornar a propria organizacao, suas filhas (credores) e a organizacao SPC_BRASIL
  return db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId, linkedToOrganizationId: organizations.linkedToOrganizationId, type: organizations.type, legalName: organizations.legalName, tradeName: organizations.tradeName, status: organizations.status }).from(organizations).where(
    actor.role === "SPC_ADMIN"
      ? isNull(organizations.deletedAt)
      : and(isNull(organizations.deletedAt), or(eq(organizations.id, actor.organizationId), eq(organizations.linkedToOrganizationId, actor.organizationId), eq(organizations.parentOrganizationId, actor.organizationId), eq(organizations.type, "SPC_BRASIL"))),
  ).orderBy(desc(organizations.createdAt));
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
  const creditor = await db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId, linkedToOrganizationId: organizations.linkedToOrganizationId, type: organizations.type, status: organizations.status }).from(organizations).where(eq(organizations.id, creditorOrganizationId)).limit(1);
  const creditorOwnerId = creditor[0]?.linkedToOrganizationId ?? creditor[0]?.parentOrganizationId;
  if (!creditor[0] || creditor[0].type !== "CREDITOR" || creditor[0].status !== "ACTIVE" || creditorOwnerId !== ownerOrganizationId) {
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

export async function resolveCampaignPrice(organizationId: number, creditorOrganizationId: number, channel: Channel) {
  const db = await requireDb();
  const organizationFields = {
    id: organizations.id,
    type: organizations.type,
    status: organizations.status,
    parentOrganizationId: organizations.parentOrganizationId,
    linkedToOrganizationId: organizations.linkedToOrganizationId,
  };
  const [responsibleOrganization] = await db.select(organizationFields).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const [creditorOrganization] = await db.select(organizationFields).from(organizations).where(eq(organizations.id, creditorOrganizationId)).limit(1);
  const [spcOrganization] = await db.select(organizationFields).from(organizations).where(and(eq(organizations.type, "SPC_BRASIL"), eq(organizations.status, "ACTIVE"))).limit(1);
  if (!responsibleOrganization || !creditorOrganization || !spcOrganization) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Credor inválido ou fora do escopo da organização." });
  }
  const responsibleOwnerId = responsibleOrganization.type === "CREDITOR"
    ? responsibleOrganization.linkedToOrganizationId ?? responsibleOrganization.parentOrganizationId
    : null;
  const [linkedOrganization] = responsibleOwnerId === null
    ? []
    : await db.select(organizationFields).from(organizations).where(eq(organizations.id, responsibleOwnerId)).limit(1);
  const target = determineCampaignPricingTarget({
    responsibleOrganization,
    creditorOrganization,
    spcOrganization,
    linkedOrganization: linkedOrganization ?? null,
  });
  const now = new Date();
  const result = await db.select({ unitPriceMicros: pricingRules.unitPriceMicros }).from(pricingRules).where(and(
    eq(pricingRules.organizationId, target.priceOwnerOrganizationId),
    target.creditorOrganizationId === null ? isNull(pricingRules.creditorOrganizationId) : eq(pricingRules.creditorOrganizationId, target.creditorOrganizationId),
    eq(pricingRules.channel, channel),
    eq(pricingRules.priceType, target.priceType),
    eq(pricingRules.active, true),
    lte(pricingRules.validFrom, now),
    or(isNull(pricingRules.validUntil), gt(pricingRules.validUntil, now)),
  )).orderBy(desc(pricingRules.validFrom)).limit(1);
  if (!result[0] || result[0].unitPriceMicros < 0) {
    const message = target.priceType === "SPC_BASE"
      ? `Não existe preço-base vigente do SPC Brasil para ${channel}.`
      : `Não existe preço vigente para ${channel} neste credor.`;
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  return result[0].unitPriceMicros;
}
