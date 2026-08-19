import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { campaigns, messageTemplates, organizations } from "../drizzle/schema";
import { formatTemplatePublicId } from "../shared/template-id";
import {
  extractTemplateVariables,
  findUnsupportedTemplateVariables,
  TEMPLATE_VARIABLE_KEYS,
  templateVariablesForChannel,
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

async function assertSpcBrasilAdmin(actor: DomainActor, db: Awaited<ReturnType<typeof requireDb>>) {
  if (actor.role !== "SPC_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente administradores do SPC Brasil podem gerenciar templates." });
  }
  const [actorOrganization] = await db
    .select({ type: organizations.type })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId))
    .limit(1);
  if (actorOrganization?.type !== "SPC_BRASIL") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente administradores vinculados ao SPC Brasil podem gerenciar templates." });
  }
}

export function validateTemplateInput(channel: Channel, subject: string | null | undefined, content: string) {
  if (channel === "EMAIL" && !subject?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O assunto é obrigatório para templates de e-mail." });
  }
  if (channel === "SMS" && content.length > 612) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O template SMS excede o limite operacional de 612 caracteres." });
  }
  const unsupported = findUnsupportedTemplateVariables(subject, content, channel);
  if (unsupported.length) {
    const allowedKeys = templateVariablesForChannel(channel).map(variable => variable.key);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Variáveis não disponíveis: ${unsupported.map(variable => `{{${variable}}}`).join(", ")}. Utilize: ${allowedKeys.map(variable => `{{${variable}}}`).join(", ")}.`,
    });
  }
}

export async function listAvailableTemplates(actor: DomainActor, channel?: Channel) {
  const db = await requireDb();
  // Return templates from SPC Brasil (organizationId = 1) for all users
  const templates = await db
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
    .where(
      and(
        eq(messageTemplates.organizationId, 1), // SPC Brasil
        eq(messageTemplates.status, "ACTIVE"),
        channel ? eq(messageTemplates.channel, channel) : undefined
      )
    )
    .orderBy(messageTemplates.channel, messageTemplates.name);
  return templates.map(template => ({
    ...template,
    publicId: formatTemplatePublicId(template.id),
  }));
}

export async function listTemplates(actor: DomainActor) {
  const db = await requireDb();
  await assertSpcBrasilAdmin(actor, db);
  const templates = await db.select().from(messageTemplates).orderBy(desc(messageTemplates.updatedAt));
  return templates.map(template => ({
    ...template,
    publicId: formatTemplatePublicId(template.id),
  }));
}

export async function createTemplate(actor: DomainActor, input: { name: string; channel: Channel; subject?: string | null; content: string; status: "DRAFT" | "ACTIVE" }) {
  validateTemplateInput(input.channel, input.subject, input.content);
  const db = await requireDb();
  await assertSpcBrasilAdmin(actor, db);
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
  const publicId = formatTemplatePublicId(id);
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "TEMPLATE_CREATED", resourceType: "message_template", resourceId: id, metadata: { publicId, channel: input.channel, status: input.status, variables } });
  return { id, publicId };
}

export async function updateTemplate(actor: DomainActor, id: number, input: { name: string; channel: Channel; subject?: string | null; content: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED" }) {
  validateTemplateInput(input.channel, input.subject, input.content);
  const db = await requireDb();
  await assertSpcBrasilAdmin(actor, db);
  const normalizedSubject = input.channel === "EMAIL" ? input.subject?.trim() ?? null : null;
  const variables = extractTemplateVariables(input.subject, input.content);
  const updatedVersion = await db.transaction(async tx => {
    const [existing] = await tx.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });
    if (existing.status === "ARCHIVED") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Templates arquivados não podem ser editados ou reativados." });
    }
    await tx.update(campaigns).set({
      templateNameSnapshot: existing.name,
      templateVersionSnapshot: existing.version,
      templateSubjectSnapshot: existing.subject,
      templateContentSnapshot: existing.content,
      templateVariablesSnapshot: existing.variables,
    }).where(and(eq(campaigns.templateId, id), isNull(campaigns.templateContentSnapshot)));
    const result = await tx.update(messageTemplates).set({
      name: input.name.trim(),
      channel: input.channel,
      subject: normalizedSubject,
      content: input.content.trim(),
      variables,
      status: input.status,
      version: existing.version + 1,
    }).where(and(eq(messageTemplates.id, id), eq(messageTemplates.version, existing.version)));
    if (Number(result[0]?.affectedRows ?? 0) !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "O template foi alterado por outro usuário. Recarregue e tente novamente." });
    }
    return existing.version + 1;
  });
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "TEMPLATE_UPDATED", resourceType: "message_template", resourceId: id, metadata: { publicId: formatTemplatePublicId(id), channel: input.channel, status: input.status, version: updatedVersion } });
  return { success: true as const };
}
