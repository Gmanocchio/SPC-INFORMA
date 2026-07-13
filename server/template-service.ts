import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { messageTemplates } from "../drizzle/schema";
import { writeAudit } from "./audit";
import { getDb } from "./db";

export type DomainActor = {
  id: number;
  organizationId: number;
  role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
};

export type Channel = "SMS" | "EMAIL" | "WHATSAPP" | "RCS";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export function extractTemplateVariables(subject: string | null | undefined, content: string) {
  const values = new Set<string>();
  const expression = /{{\s*([A-Za-z_][A-Za-z0-9_.-]{0,49})\s*}}/g;
  for (const source of [subject ?? "", content]) {
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(source)) !== null) {
      if (match[1]) values.add(match[1]);
    }
  }
  return Array.from(values).sort();
}

function validateTemplate(channel: Channel, subject: string | null | undefined, content: string) {
  if (channel === "EMAIL" && !subject?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O assunto é obrigatório para templates de e-mail." });
  }
  if (channel === "SMS" && content.length > 612) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O template SMS excede o limite operacional de 612 caracteres." });
  }
}

export async function listAvailableTemplates(actor: DomainActor, channel?: Channel) {
  const db = await requireDb();
  return db
    .select({
      id: messageTemplates.id,
      name: messageTemplates.name,
      channel: messageTemplates.channel,
      subject: messageTemplates.subject,
      content: messageTemplates.content,
      variables: messageTemplates.variables,
      version: messageTemplates.version,
    })
    .from(messageTemplates)
    .where(and(eq(messageTemplates.status, "ACTIVE"), channel ? eq(messageTemplates.channel, channel) : undefined))
    .orderBy(messageTemplates.channel, messageTemplates.name);
}

export async function listTemplates(actor: DomainActor) {
  if (actor.role !== "SPC_ADMIN") throw new TRPCError({ code: "FORBIDDEN" });
  const db = await requireDb();
  return db.select().from(messageTemplates).orderBy(desc(messageTemplates.updatedAt));
}

export async function createTemplate(actor: DomainActor, input: { name: string; channel: Channel; subject?: string | null; content: string; status: "DRAFT" | "ACTIVE" }) {
  validateTemplate(input.channel, input.subject, input.content);
  const db = await requireDb();
  const variables = extractTemplateVariables(input.subject, input.content);
  const result = await db.insert(messageTemplates).values({
    organizationId: actor.organizationId,
    name: input.name.trim(),
    channel: input.channel,
    subject: input.channel === "EMAIL" ? input.subject?.trim() ?? null : null,
    content: input.content.trim(),
    variables,
    status: input.status,
    createdByUserId: actor.id,
  });
  const id = Number(result[0].insertId);
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "TEMPLATE_CREATED", resourceType: "message_template", resourceId: id, metadata: { channel: input.channel, status: input.status, variables } });
  return { id };
}

export async function updateTemplate(actor: DomainActor, id: number, input: { name: string; channel: Channel; subject?: string | null; content: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED" }) {
  validateTemplate(input.channel, input.subject, input.content);
  const db = await requireDb();
  const existing = await db.select({ id: messageTemplates.id, version: messageTemplates.version }).from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
  if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });
  const variables = extractTemplateVariables(input.subject, input.content);
  await db.update(messageTemplates).set({
    name: input.name.trim(),
    channel: input.channel,
    subject: input.channel === "EMAIL" ? input.subject?.trim() ?? null : null,
    content: input.content.trim(),
    variables,
    status: input.status,
    version: existing[0].version + 1,
  }).where(eq(messageTemplates.id, id));
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "TEMPLATE_UPDATED", resourceType: "message_template", resourceId: id, metadata: { channel: input.channel, status: input.status, version: existing[0].version + 1 } });
  return { success: true as const };
}
