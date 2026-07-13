import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { messageTemplates } from "../drizzle/schema";
import {
  extractTemplateVariables,
  findUnsupportedTemplateVariables,
  TEMPLATE_VARIABLE_KEYS,
} from "../shared/template-variables";
import { writeAudit } from "./audit";
import { getDb } from "./db";

export { extractTemplateVariables } from "../shared/template-variables";

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

export function validateTemplateInput(channel: Channel, subject: string | null | undefined, content: string) {
  if (channel === "EMAIL" && !subject?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O assunto é obrigatório para templates de e-mail." });
  }
  if (channel === "SMS" && content.length > 612) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O template SMS excede o limite operacional de 612 caracteres." });
  }
  const unsupported = findUnsupportedTemplateVariables(subject, content);
  if (unsupported.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Variáveis não disponíveis: ${unsupported.map(variable => `{{${variable}}}`).join(", ")}. Utilize: ${TEMPLATE_VARIABLE_KEYS.map(variable => `{{${variable}}}`).join(", ")}.`,
    });
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
  validateTemplateInput(input.channel, input.subject, input.content);
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
  validateTemplateInput(input.channel, input.subject, input.content);
  const db = await requireDb();
  const existing = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
  if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });
  if (existing[0].status === "ARCHIVED") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Templates arquivados não podem ser editados ou reativados." });
  }
  const normalizedSubject = input.channel === "EMAIL" ? input.subject?.trim() ?? null : null;
  if (existing[0].status === "ACTIVE") {
    const contentChanged = existing[0].channel !== input.channel
      || existing[0].subject !== normalizedSubject
      || existing[0].content !== input.content.trim();
    if (contentChanged || input.status === "DRAFT") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "O conteúdo de um template ativo é imutável. Arquive-o e crie um novo rascunho para alterar a mensagem.",
      });
    }
  }
  const variables = extractTemplateVariables(input.subject, input.content);
  await db.update(messageTemplates).set({
    name: input.name.trim(),
    channel: input.channel,
    subject: normalizedSubject,
    content: input.content.trim(),
    variables,
    status: input.status,
    version: existing[0].version + 1,
  }).where(eq(messageTemplates.id, id));
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "TEMPLATE_UPDATED", resourceType: "message_template", resourceId: id, metadata: { channel: input.channel, status: input.status, version: existing[0].version + 1 } });
  return { success: true as const };
}
