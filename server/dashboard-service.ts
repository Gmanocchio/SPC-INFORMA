import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { campaigns, organizations } from "../drizzle/schema";
import { getDb } from "./db";

type DashboardRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
type DashboardOrganizationType = "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
type DashboardActor = { organizationId: number; role: DashboardRole };
type DashboardScopeActor = DashboardActor & { organizationType: DashboardOrganizationType };
type CreditorOption = { id: number; tradeName: string };

export function resolveDashboardCreditorScope(
  actor: DashboardScopeActor,
  linkedCreditors: CreditorOption[],
  requestedCreditorId?: number,
) {
  if (actor.organizationType === "CREDITOR") {
    if (requestedCreditorId !== undefined && requestedCreditorId !== actor.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Credor inválido ou fora do escopo do dashboard." });
    }
    return {
      canFilterByCreditor: false,
      creditorIds: [actor.organizationId],
      creditorOptions: [] as CreditorOption[],
      selectedCreditorId: actor.organizationId,
    };
  }

  const canFilterByCreditor = actor.role === "ORG_ADMIN"
    && (actor.organizationType === "DISTRIBUTOR" || actor.organizationType === "CDL");

  if (canFilterByCreditor) {
    if (requestedCreditorId !== undefined && !linkedCreditors.some(creditor => creditor.id === requestedCreditorId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Credor inválido ou fora do escopo do dashboard." });
    }
    return {
      canFilterByCreditor: true,
      creditorIds: requestedCreditorId === undefined ? linkedCreditors.map(creditor => creditor.id) : [requestedCreditorId],
      creditorOptions: linkedCreditors,
      selectedCreditorId: requestedCreditorId ?? null,
    };
  }

  if (requestedCreditorId !== undefined) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Filtro por credor indisponível para este usuário." });
  }
  return {
    canFilterByCreditor: false,
    creditorIds: [] as number[],
    creditorOptions: [] as CreditorOption[],
    selectedCreditorId: null,
  };
}

export async function dashboardOverview(actor: DashboardActor, requestedCreditorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const [organization] = await db.select({
    type: organizations.type,
    billingModel: organizations.billingModel,
    balanceCents: organizations.balanceCents,
    creditLimitCents: organizations.creditLimitCents,
  }).from(organizations).where(eq(organizations.id, actor.organizationId)).limit(1);
  if (!organization) throw new TRPCError({ code: "NOT_FOUND", message: "Organização do usuário não encontrada." });

  const isLinkedCreditorAdmin = actor.role === "ORG_ADMIN"
    && (organization.type === "DISTRIBUTOR" || organization.type === "CDL");
  const linkedCreditors = isLinkedCreditorAdmin
    ? await db.select({ id: organizations.id, tradeName: organizations.tradeName })
      .from(organizations)
      .where(and(
        eq(organizations.type, "CREDITOR"),
        eq(organizations.status, "ACTIVE"),
        or(
          eq(organizations.linkedToOrganizationId, actor.organizationId),
          and(isNull(organizations.linkedToOrganizationId), eq(organizations.parentOrganizationId, actor.organizationId)),
        ),
      ))
      .orderBy(organizations.tradeName)
    : [];
  const creditorScope = resolveDashboardCreditorScope(
    { ...actor, organizationType: organization.type },
    linkedCreditors,
    requestedCreditorId,
  );

  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const annualPeriodStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const buildScope = (start: Date) => {
    const dateScope = gte(campaigns.createdAt, start);
    if (actor.role === "SPC_ADMIN") return dateScope;
    if (organization.type === "CREDITOR") {
      return and(eq(campaigns.creditorOrganizationId, actor.organizationId), dateScope);
    }
    if (creditorScope.canFilterByCreditor) {
      return creditorScope.creditorIds.length
        ? and(inArray(campaigns.creditorOrganizationId, creditorScope.creditorIds), dateScope)
        : and(sql`0 = 1`, dateScope);
    }
    return and(eq(campaigns.organizationId, actor.organizationId), dateScope);
  };
  const scope = buildScope(periodStart);
  const annualScope = buildScope(annualPeriodStart);
  const processedScope = and(scope, isNotNull(campaigns.confirmedAt));
  const annualProcessedScope = and(annualScope, isNotNull(campaigns.confirmedAt));

  const [summary] = await db.select({
    campaignCount: sql<number>`COUNT(*)`,
    sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
    delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
    failed: sql<number>`COALESCE(SUM(${campaigns.failedCount}), 0)`,
    processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
  }).from(campaigns).where(processedScope);
  const byChannel = await db.select({
    channel: campaigns.channel,
    sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
    delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
    failed: sql<number>`COALESCE(SUM(${campaigns.failedCount}), 0)`,
  }).from(campaigns).where(processedScope).groupBy(campaigns.channel).orderBy(campaigns.channel);
  const byDay: { period: string; sent: number; delivered: number }[] = [];
  const byMonth: { period: string; sent: number; delivered: number }[] = [];
  const byOrganization = actor.role === "SPC_ADMIN"
    ? await db.select({
      organizationId: organizations.id,
      organizationName: organizations.tradeName,
      organizationType: organizations.type,
      sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
      delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
      processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
    }).from(campaigns).innerJoin(organizations, eq(organizations.id, campaigns.organizationId)).where(processedScope).groupBy(organizations.id, organizations.tradeName, organizations.type).orderBy(desc(sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`)).limit(20).catch(() => [])
    : [];
  const byCreditor = creditorScope.canFilterByCreditor
    ? await db.select({
      creditorOrganizationId: organizations.id,
      creditorName: organizations.tradeName,
      sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
      delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
      failed: sql<number>`COALESCE(SUM(${campaigns.failedCount}), 0)`,
      processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
    }).from(campaigns)
      .innerJoin(organizations, eq(organizations.id, campaigns.creditorOrganizationId))
      .where(processedScope)
      .groupBy(organizations.id, organizations.tradeName)
      .orderBy(desc(sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`))
    : [];
  const byStatus = await db.select({ status: campaigns.status, count: sql<number>`COUNT(*)` }).from(campaigns).where(scope).groupBy(campaigns.status).orderBy(desc(sql<number>`COUNT(*)`));
  const activeScope = and(scope, sql`${campaigns.status} IN ('PROCESSING', 'SCHEDULED', 'QUEUED')`);
  const recent = await db.select({ id: campaigns.id, name: campaigns.name, channel: campaigns.channel, status: campaigns.status, validRecipients: campaigns.validRecipientCount, deliveredRecipients: campaigns.deliveredCount, failedRecipients: campaigns.failedCount, createdAt: campaigns.createdAt }).from(campaigns).where(scope).orderBy(desc(campaigns.createdAt)).limit(5);
  const activeCampaigns = await db.select({ id: campaigns.id, name: campaigns.name, channel: campaigns.channel, status: campaigns.status, validRecipients: campaigns.validRecipientCount, deliveredRecipients: campaigns.deliveredCount, failedRecipients: campaigns.failedCount, createdAt: campaigns.createdAt }).from(campaigns).where(activeScope).orderBy(desc(campaigns.createdAt)).limit(10);
  const sent = Number(summary?.sent ?? 0);
  const delivered = Number(summary?.delivered ?? 0);
  return {
    periodStart,
    campaignCount: Number(summary?.campaignCount ?? 0),
    sent,
    delivered,
    failed: Number(summary?.failed ?? 0),
    processedMicros: Number(summary?.processedMicros ?? 0),
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    byChannel: byChannel.map(item => ({ channel: item.channel, sent: Number(item.sent), delivered: Number(item.delivered), failed: Number(item.failed) })),
    byDay,
    byMonth,
    byOrganization: byOrganization.map(item => ({ ...item, sent: Number(item.sent), delivered: Number(item.delivered), processedMicros: Number(item.processedMicros) })),
    byCreditor: byCreditor.map(item => ({ ...item, sent: Number(item.sent), delivered: Number(item.delivered), failed: Number(item.failed), processedMicros: Number(item.processedMicros) })),
    byStatus: byStatus.map(item => ({ status: item.status, count: Number(item.count) })),
    recent,
    activeCampaigns,
    canFilterByCreditor: creditorScope.canFilterByCreditor,
    creditorOptions: creditorScope.creditorOptions,
    selectedCreditorId: creditorScope.selectedCreditorId,
    financial: actor.role === "SPC_ADMIN" ? null : {
      billingModel: organization.billingModel,
      balanceCents: organization.balanceCents,
      creditLimitCents: organization.creditLimitCents,
    },
  };
}
