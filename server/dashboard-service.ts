import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { campaigns, deliveryEvents, organizations } from "../drizzle/schema";
import { getDb } from "./db";

type DashboardRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
type DashboardOrganizationType = "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
type DashboardActor = { organizationId: number; role: DashboardRole };
type DashboardScopeActor = DashboardActor & { organizationType: DashboardOrganizationType };
type CreditorOption = { id: number; tradeName: string };

type ConsolidationParentType = Exclude<DashboardOrganizationType, "CREDITOR">;
type ConsolidationOrganization = {
  id: number;
  organizationName: string;
  organizationType: DashboardOrganizationType;
  linkedToOrganizationId: number | null;
  parentOrganizationId: number | null;
};
type ConsolidationMetric = {
  creditorOrganizationId: number;
  organizationId?: number;
  sent: number;
  delivered: number;
  failed: number;
  processedMicros: number;
};

export type OrganizationConsolidationGroup = {
  organizationId: number;
  organizationName: string;
  organizationType: ConsolidationParentType;
  sent: number;
  delivered: number;
  failed: number;
  processedMicros: number;
  creditors: Array<{
    creditorOrganizationId: number;
    creditorName: string;
    sent: number;
    delivered: number;
    failed: number;
    processedMicros: number;
  }>;
};

const consolidationTypeOrder: ConsolidationParentType[] = ["CDL", "DISTRIBUTOR", "SPC_BRASIL"];

export function calculateDashboardRates(input: {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  spam: number;
}) {
  const percentage = (value: number, denominator: number) => denominator > 0 ? (value / denominator) * 100 : 0;
  return {
    deliveryRate: percentage(input.delivered, input.sent),
    openRate: percentage(input.opened, input.delivered),
    clickRate: percentage(input.clicked, input.delivered),
    spamRate: percentage(input.spam, input.delivered),
  };
}

export function buildSpcOrganizationConsolidation(
  spcOrganizationId: number,
  sourceOrganizations: ConsolidationOrganization[],
  sourceMetrics: ConsolidationMetric[],
): OrganizationConsolidationGroup[] {
  const metricsByCreditorId = new Map<number, ConsolidationMetric[]>();
  for (const metric of sourceMetrics) {
    const creditorMetrics = metricsByCreditorId.get(metric.creditorOrganizationId) ?? [];
    creditorMetrics.push(metric);
    metricsByCreditorId.set(metric.creditorOrganizationId, creditorMetrics);
  }
  const parents = sourceOrganizations.filter((organization): organization is ConsolidationOrganization & { organizationType: ConsolidationParentType } => (
    organization.organizationType !== "CREDITOR"
    && (organization.organizationType !== "SPC_BRASIL" || organization.id === spcOrganizationId)
  ));
  const parentById = new Map(parents.map(parent => [parent.id, parent]));
  const creditorsByParentId = new Map<number, OrganizationConsolidationGroup["creditors"]>();

  for (const creditor of sourceOrganizations) {
    if (creditor.organizationType !== "CREDITOR") continue;
    const explicitParentId = creditor.linkedToOrganizationId ?? creditor.parentOrganizationId;
    const creditorMetrics = metricsByCreditorId.get(creditor.id) ?? [];
    const hasDirectSpcDispatches = creditorMetrics.some(metric => (
      metric.organizationId === spcOrganizationId && metric.sent > 0
    ));
    const parentId = explicitParentId ?? (hasDirectSpcDispatches ? spcOrganizationId : null);
    if (parentId === null || !parentById.has(parentId)) continue;
    const applicableMetrics = explicitParentId === null
      ? creditorMetrics.filter(metric => metric.organizationId === spcOrganizationId)
      : creditorMetrics;
    const metric = applicableMetrics.reduce((total, item) => ({
      sent: total.sent + item.sent,
      delivered: total.delivered + item.delivered,
      failed: total.failed + item.failed,
      processedMicros: total.processedMicros + item.processedMicros,
    }), { sent: 0, delivered: 0, failed: 0, processedMicros: 0 });
    const creditors = creditorsByParentId.get(parentId) ?? [];
    creditors.push({
      creditorOrganizationId: creditor.id,
      creditorName: creditor.organizationName,
      sent: metric.sent,
      delivered: metric.delivered,
      failed: metric.failed,
      processedMicros: metric.processedMicros,
    });
    creditorsByParentId.set(parentId, creditors);
  }

  return parents
    .map(parent => {
      const creditors = (creditorsByParentId.get(parent.id) ?? [])
        .sort((left, right) => left.creditorName.localeCompare(right.creditorName, "pt-BR"));
      return {
        organizationId: parent.id,
        organizationName: parent.organizationName,
        organizationType: parent.organizationType,
        sent: creditors.reduce((total, creditor) => total + creditor.sent, 0),
        delivered: creditors.reduce((total, creditor) => total + creditor.delivered, 0),
        failed: creditors.reduce((total, creditor) => total + creditor.failed, 0),
        processedMicros: creditors.reduce((total, creditor) => total + creditor.processedMicros, 0),
        creditors,
      };
    })
    .sort((left, right) => {
      const typeDifference = consolidationTypeOrder.indexOf(left.organizationType) - consolidationTypeOrder.indexOf(right.organizationType);
      return typeDifference || left.organizationName.localeCompare(right.organizationName, "pt-BR");
    });
}

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
    baseIncluded: sql<number>`COALESCE(SUM(${campaigns.recipientCount}), 0)`,
    sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
    delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
    failed: sql<number>`COALESCE(SUM(${campaigns.failedCount}), 0)`,
    processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
  }).from(campaigns).where(processedScope);
  const [engagementSummary] = await db.select({
    opened: sql<number>`COUNT(DISTINCT CASE WHEN ${deliveryEvents.eventType} = 'READ' THEN ${deliveryEvents.recipientId} END)`,
    clicked: sql<number>`COUNT(DISTINCT CASE WHEN ${deliveryEvents.eventType} = 'CLICKED' THEN ${deliveryEvents.recipientId} END)`,
    spam: sql<number>`COUNT(DISTINCT CASE WHEN ${deliveryEvents.eventType} = 'SPAM' THEN ${deliveryEvents.recipientId} END)`,
  }).from(deliveryEvents)
    .innerJoin(campaigns, eq(campaigns.id, deliveryEvents.campaignId))
    .where(processedScope);
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
  let organizationConsolidation: OrganizationConsolidationGroup[] = [];
  if (actor.role === "SPC_ADMIN" && organization.type === "SPC_BRASIL") {
    const parentOrganizations = await db.select({
      id: organizations.id,
      organizationName: organizations.tradeName,
      organizationType: organizations.type,
      linkedToOrganizationId: organizations.linkedToOrganizationId,
      parentOrganizationId: organizations.parentOrganizationId,
    }).from(organizations).where(and(
      isNull(organizations.deletedAt),
      eq(organizations.status, "ACTIVE"),
      or(
        eq(organizations.id, actor.organizationId),
        inArray(organizations.type, ["CDL", "DISTRIBUTOR"]),
      ),
    ));
    const parentIds = parentOrganizations.map(parent => parent.id);
    const creditorMetrics = await db.select({
      creditorOrganizationId: campaigns.creditorOrganizationId,
      organizationId: campaigns.organizationId,
      sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
      delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
      failed: sql<number>`COALESCE(SUM(${campaigns.failedCount}), 0)`,
      processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
    }).from(campaigns)
      .where(processedScope)
      .groupBy(campaigns.creditorOrganizationId, campaigns.organizationId);
    const directSpcCreditorIds = Array.from(new Set(
      creditorMetrics
        .filter(metric => metric.organizationId === actor.organizationId && Number(metric.sent) > 0)
        .map(metric => metric.creditorOrganizationId),
    ));
    const creditorOrganizations = await db.select({
      id: organizations.id,
      organizationName: organizations.tradeName,
      organizationType: organizations.type,
      linkedToOrganizationId: organizations.linkedToOrganizationId,
      parentOrganizationId: organizations.parentOrganizationId,
    }).from(organizations).where(and(
      isNull(organizations.deletedAt),
      eq(organizations.status, "ACTIVE"),
      eq(organizations.type, "CREDITOR"),
      or(
        inArray(organizations.linkedToOrganizationId, parentIds),
        and(isNull(organizations.linkedToOrganizationId), inArray(organizations.parentOrganizationId, parentIds)),
        directSpcCreditorIds.length ? inArray(organizations.id, directSpcCreditorIds) : sql`0 = 1`,
      ),
    ));
    organizationConsolidation = buildSpcOrganizationConsolidation(
      actor.organizationId,
      [...parentOrganizations, ...creditorOrganizations],
      creditorMetrics.map(metric => ({
        creditorOrganizationId: metric.creditorOrganizationId,
        organizationId: metric.organizationId,
        sent: Number(metric.sent),
        delivered: Number(metric.delivered),
        failed: Number(metric.failed),
        processedMicros: Number(metric.processedMicros),
      })),
    );
  }
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
  const opened = Number(engagementSummary?.opened ?? 0);
  const clicked = Number(engagementSummary?.clicked ?? 0);
  const spam = Number(engagementSummary?.spam ?? 0);
  const rates = calculateDashboardRates({ sent, delivered, opened, clicked, spam });
  return {
    periodStart,
    campaignCount: Number(summary?.campaignCount ?? 0),
    baseIncluded: Number(summary?.baseIncluded ?? 0),
    sent,
    delivered,
    opened,
    clicked,
    spam: actor.role === "SPC_ADMIN" ? spam : null,
    failed: Number(summary?.failed ?? 0),
    processedMicros: Number(summary?.processedMicros ?? 0),
    deliveryRate: rates.deliveryRate,
    openRate: rates.openRate,
    clickRate: rates.clickRate,
    spamRate: actor.role === "SPC_ADMIN" ? rates.spamRate : null,
    byChannel: byChannel.map(item => ({ channel: item.channel, sent: Number(item.sent), delivered: Number(item.delivered), failed: Number(item.failed) })),
    byDay,
    byMonth,
    byOrganization: byOrganization.map(item => ({ ...item, sent: Number(item.sent), delivered: Number(item.delivered), processedMicros: Number(item.processedMicros) })),
    organizationConsolidation,
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
