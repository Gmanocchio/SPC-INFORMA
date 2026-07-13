import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { campaigns, organizations } from "../drizzle/schema";
import { getDb } from "./db";

type DashboardActor = { organizationId: number; role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" };

export async function dashboardOverview(actor: DashboardActor) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const annualPeriodStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const scope = actor.role === "SPC_ADMIN"
    ? gte(campaigns.createdAt, periodStart)
    : and(eq(campaigns.organizationId, actor.organizationId), gte(campaigns.createdAt, periodStart));
  const annualScope = actor.role === "SPC_ADMIN"
    ? gte(campaigns.createdAt, annualPeriodStart)
    : and(eq(campaigns.organizationId, actor.organizationId), gte(campaigns.createdAt, annualPeriodStart));
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
  const dayExpression = sql<string>`DATE_FORMAT(${campaigns.createdAt}, '%Y-%m-%d')`;
  const monthExpression = sql<string>`DATE_FORMAT(${campaigns.createdAt}, '%Y-%m')`;
  const byDay = await db.select({
    period: dayExpression,
    sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
    delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
  }).from(campaigns).where(processedScope).groupBy(dayExpression).orderBy(dayExpression);
  const byMonth = await db.select({
    period: monthExpression,
    sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
    delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
  }).from(campaigns).where(annualProcessedScope).groupBy(monthExpression).orderBy(monthExpression);
  const byOrganization = actor.role === "SPC_ADMIN"
    ? await db.select({
      organizationId: organizations.id,
      organizationName: organizations.tradeName,
      organizationType: organizations.type,
      sent: sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`,
      delivered: sql<number>`COALESCE(SUM(${campaigns.deliveredCount}), 0)`,
      processedMicros: sql<number>`COALESCE(SUM(${campaigns.totalCostMicros}), 0)`,
    }).from(campaigns).innerJoin(organizations, eq(organizations.id, campaigns.organizationId)).where(processedScope).groupBy(organizations.id, organizations.tradeName, organizations.type).orderBy(desc(sql<number>`COALESCE(SUM(${campaigns.validRecipientCount}), 0)`)).limit(20)
    : [];
  const byStatus = await db.select({ status: campaigns.status, count: sql<number>`COUNT(*)` }).from(campaigns).where(scope).groupBy(campaigns.status).orderBy(desc(sql<number>`COUNT(*)`));
  const recent = await db.select({ id: campaigns.id, name: campaigns.name, channel: campaigns.channel, status: campaigns.status, validRecipients: campaigns.validRecipientCount, deliveredRecipients: campaigns.deliveredCount, failedRecipients: campaigns.failedCount, createdAt: campaigns.createdAt }).from(campaigns).where(scope).orderBy(desc(campaigns.createdAt)).limit(5);
  const [organization] = actor.role === "SPC_ADMIN" ? [] : await db.select({ billingModel: organizations.billingModel, balanceCents: organizations.balanceCents, creditLimitCents: organizations.creditLimitCents }).from(organizations).where(eq(organizations.id, actor.organizationId)).limit(1);
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
    byDay: byDay.map(item => ({ period: item.period, sent: Number(item.sent), delivered: Number(item.delivered) })),
    byMonth: byMonth.map(item => ({ period: item.period, sent: Number(item.sent), delivered: Number(item.delivered) })),
    byOrganization: byOrganization.map(item => ({ ...item, sent: Number(item.sent), delivered: Number(item.delivered), processedMicros: Number(item.processedMicros) })),
    byStatus: byStatus.map(item => ({ status: item.status, count: Number(item.count) })),
    recent,
    financial: organization ?? null,
  };
}
