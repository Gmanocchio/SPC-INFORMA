import { randomUUID } from "node:crypto";
import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

type AuditInput = {
  organizationId?: number | null;
  actorUserId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  outcome?: "SUCCESS" | "DENIED" | "FAILURE";
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para auditoria.");
  await db.insert(auditLogs).values({
    organizationId: input.organizationId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId == null ? null : String(input.resourceId),
    outcome: input.outcome ?? "SUCCESS",
    correlationId: randomUUID(),
    metadata: input.metadata ?? {},
  });
}

