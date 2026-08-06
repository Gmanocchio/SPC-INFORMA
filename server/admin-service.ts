import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { organizations, users } from "../drizzle/schema";
import { writeAudit } from "./audit";
import { getDb } from "./db";
import { normalizeCnpj, normalizeCpf, normalizePhone } from "./br-validation";
import { assertStrongPassword, hashPassword } from "./security";
import { storagePut } from "./storage";
import { canManageOrganization } from "./authorization";

type Actor = {
  id: number;
  organizationId: number;
  role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
};

type OrganizationInput = {
  parentOrganizationId?: number | null;
  linkedToOrganizationId?: number | null;
  type: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
  legalName: string;
  tradeName: string;
  cnpj: string;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  addressExtra?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  billingModel: "PREPAID" | "POSTPAID";
  balanceCents?: number;
  creditLimitCents?: number;
};

type UserInput = {
  organizationId: number;
  name: string;
  cpf: string;
  email: string;
  phone?: string | null;
  initialPassword: string;
  role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";
};

type OrganizationScopeTarget = Pick<typeof organizations.$inferSelect, "id" | "parentOrganizationId" | "linkedToOrganizationId" | "type" | "status">;

export function isManagedChildOrganization(actor: Actor, target: OrganizationScopeTarget) {
  return actor.role === "ORG_ADMIN"
    && target.type === "CREDITOR"
    && target.status === "ACTIVE"
    && (target.linkedToOrganizationId ?? target.parentOrganizationId) === actor.organizationId;
}

export function canAssignUserToOrganization(actor: Actor, target: OrganizationScopeTarget, role: UserInput["role"]) {
  if (actor.role === "SPC_ADMIN") return true;
  if (actor.role !== "ORG_ADMIN" || role === "SPC_ADMIN") return false;
  return target.id === actor.organizationId || (role === "REQUESTER" && isManagedChildOrganization(actor, target));
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

async function findOrganization(id: number) {
  const db = await requireDb();
  return (await db.select().from(organizations).where(and(eq(organizations.id, id), isNull(organizations.deletedAt))).limit(1))[0];
}

export async function listOrganizations(actor: Actor, input: { search?: string; type?: OrganizationInput["type"] }) {
  const db = await requireDb();
  const projection = {
    id: organizations.id,
    parentOrganizationId: organizations.parentOrganizationId,
    linkedToOrganizationId: organizations.linkedToOrganizationId,
    type: organizations.type,
    legalName: organizations.legalName,
    tradeName: organizations.tradeName,
    cnpj: organizations.cnpj,
    responsibleName: organizations.responsibleName,
    responsibleEmail: organizations.responsibleEmail,
    responsiblePhone: organizations.responsiblePhone,
    logoUrl: organizations.logoUrl,
    postalCode: organizations.postalCode,
    street: organizations.street,
    streetNumber: organizations.streetNumber,
    addressExtra: organizations.addressExtra,
    district: organizations.district,
    city: organizations.city,
    state: organizations.state,
    billingModel: organizations.billingModel,
    balanceCents: organizations.balanceCents,
    creditLimitCents: organizations.creditLimitCents,
    status: organizations.status,
    createdAt: organizations.createdAt,
  };
  const search = input.search?.trim();
  const textFilter = search
    ? or(like(organizations.tradeName, `%${search}%`), like(organizations.legalName, `%${search}%`), like(organizations.cnpj, `%${normalizeCnpj(search)}%`))
    : undefined;
  if (actor.role === "SPC_ADMIN") {
    return db.select(projection).from(organizations).where(and(isNull(organizations.deletedAt), input.type ? eq(organizations.type, input.type) : undefined, textFilter)).orderBy(desc(organizations.createdAt)).limit(200);
  }
  // Para administradores de CDL e Distribuidora: retornar a própria organização e credores diretamente vinculados.
  return db.select(projection).from(organizations).where(and(isNull(organizations.deletedAt), or(eq(organizations.id, actor.organizationId), eq(organizations.linkedToOrganizationId, actor.organizationId), and(isNull(organizations.linkedToOrganizationId), eq(organizations.parentOrganizationId, actor.organizationId))), input.type ? eq(organizations.type, input.type) : undefined, textFilter)).orderBy(desc(organizations.createdAt)).limit(200);
}

export async function createOrganization(actor: Actor, input: OrganizationInput) {
  const db = await requireDb();
  if (actor.role !== "SPC_ADMIN" && input.type !== "CREDITOR") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administradores de organização podem cadastrar apenas credores vinculados." });
  }
  const parentOrganizationId = actor.role === "SPC_ADMIN" ? input.parentOrganizationId ?? null : actor.organizationId;
  // Se usuário não é admin SPC e está criando credor, vincula automaticamente à sua organização
  const linkedToOrganizationId = actor.role !== "SPC_ADMIN" && input.type === "CREDITOR" ? actor.organizationId : (input.linkedToOrganizationId ?? null);
  const result = await db.insert(organizations).values({
    ...input,
    parentOrganizationId,
    linkedToOrganizationId,
    cnpj: normalizeCnpj(input.cnpj),
    responsibleEmail: input.responsibleEmail.trim().toLowerCase(),
    responsiblePhone: normalizePhone(input.responsiblePhone),
    postalCode: input.postalCode ? input.postalCode.replace(/\D/g, "") : null,
    state: input.state?.toUpperCase() ?? null,
    balanceCents: input.balanceCents ?? 0,
    creditLimitCents: input.creditLimitCents ?? 0,
    status: "ACTIVE",
  });
  const id = Number(result[0].insertId);
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "ORGANIZATION_CREATED", resourceType: "organization", resourceId: id, metadata: { targetType: input.type, parentOrganizationId } });
  return { id };
}

export async function updateOrganization(actor: Actor, id: number, input: Partial<Omit<OrganizationInput, "type" | "cnpj" | "parentOrganizationId">> & { status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" }) {
  const target = await findOrganization(id);
  if (!target || !canManageOrganization(actor, target)) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada no seu escopo." });
  const db = await requireDb();
  await db.update(organizations).set({
    ...input,
    responsibleEmail: input.responsibleEmail?.trim().toLowerCase(),
    responsiblePhone: input.responsiblePhone === undefined ? undefined : normalizePhone(input.responsiblePhone),
    postalCode: input.postalCode === undefined ? undefined : input.postalCode?.replace(/\D/g, "") ?? null,
    state: input.state === undefined ? undefined : input.state?.toUpperCase() ?? null,
  }).where(eq(organizations.id, id));
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "ORGANIZATION_UPDATED", resourceType: "organization", resourceId: id, metadata: { changedFields: Object.keys(input) } });
  return { success: true as const };
}

const logoTypes = {
  "image/png": {
    extension: "png",
    valid: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/jpeg": {
    extension: "jpg",
    valid: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/webp": {
    extension: "webp",
    valid: (bytes: Buffer) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
  },
} as const;

export async function uploadOrganizationLogo(actor: Actor, id: number, mimeType: keyof typeof logoTypes, base64: string) {
  const target = await findOrganization(id);
  if (!target || !canManageOrganization(actor, target)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada no seu escopo." });
  }
  const definition = logoTypes[mimeType];
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > 1024 * 1024 || !definition.valid(bytes)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem inválida. Use PNG, JPG ou WEBP com até 1 MB." });
  }
  const key = `organizations/${id}/logo-${randomUUID()}.${definition.extension}`;
  const stored = await storagePut(key, bytes, mimeType);
  const db = await requireDb();
  await db.update(organizations).set({ logoKey: stored.key, logoUrl: stored.url }).where(eq(organizations.id, id));
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "ORGANIZATION_LOGO_UPDATED", resourceType: "organization", resourceId: id, metadata: { mimeType, size: bytes.length } });
  return { logoUrl: stored.url };
}

export async function listUsers(actor: Actor, input: { organizationId?: number; search?: string; includeManagedOrganizations?: boolean }) {
  const db = await requireDb();
  let organizationScope = actor.role === "SPC_ADMIN"
    ? (input.organizationId ? eq(users.organizationId, input.organizationId) : undefined)
    : eq(users.organizationId, actor.organizationId);
  if (actor.role === "ORG_ADMIN" && input.includeManagedOrganizations) {
    const managedOrganizations = await db.select({ id: organizations.id }).from(organizations).where(and(isNull(organizations.deletedAt), eq(organizations.type, "CREDITOR"), eq(organizations.status, "ACTIVE"), or(eq(organizations.linkedToOrganizationId, actor.organizationId), and(isNull(organizations.linkedToOrganizationId), eq(organizations.parentOrganizationId, actor.organizationId))))).limit(200);
    const managedOrganizationIds = managedOrganizations.map(organization => organization.id);
    organizationScope = managedOrganizationIds.length
      ? or(eq(users.organizationId, actor.organizationId), and(inArray(users.organizationId, managedOrganizationIds), eq(users.role, "REQUESTER")))
      : eq(users.organizationId, actor.organizationId);
  }
  const search = input.search?.trim();
  return db.select({
    id: users.id,
    organizationId: users.organizationId,
    name: users.name,
    cpf: users.cpf,
    email: users.email,
    phone: users.phone,
    role: users.role,
    status: users.status,
    mustChangePassword: users.mustChangePassword,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt,
  }).from(users).where(and(isNull(users.deletedAt), organizationScope, search ? or(like(users.name, `%${search}%`), like(users.email, `%${search}%`), like(users.cpf, `%${normalizeCpf(search)}%`)) : undefined)).orderBy(desc(users.createdAt)).limit(200);
}

export async function createUser(actor: Actor, input: UserInput) {
  const targetOrganization = await findOrganization(input.organizationId);
  if (!targetOrganization || !canAssignUserToOrganization(actor, targetOrganization, input.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Perfil ou organização não permitido para este administrador." });
  }
  if (input.role === "SPC_ADMIN" && targetOrganization.type !== "SPC_BRASIL") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Administradores SPC devem pertencer à organização SPC Brasil." });
  }
  assertStrongPassword(input.initialPassword);
  const passwordHash = await hashPassword(input.initialPassword);
  const db = await requireDb();
  const result = await db.insert(users).values({
    organizationId: input.organizationId,
    name: input.name.trim(),
    cpf: normalizeCpf(input.cpf),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    passwordHash,
    role: input.role,
    status: "INVITED",
    mustChangePassword: true,
    createdByUserId: actor.id,
  });
  const id = Number(result[0].insertId);
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "USER_CREATED", resourceType: "user", resourceId: id, metadata: { targetOrganizationId: input.organizationId, role: input.role } });
  return { id };
}

export async function updateUser(actor: Actor, id: number, input: { name?: string; email?: string; phone?: string | null; role?: UserInput["role"]; status?: "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED" }) {
  const db = await requireDb();
  const target = (await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1))[0];
  const targetOrganization = target ? await findOrganization(target.organizationId) : undefined;
  const targetRole = input.role ?? target?.role ?? "REQUESTER";
  if (!target || !targetOrganization || !canAssignUserToOrganization(actor, targetOrganization, targetRole) || (isManagedChildOrganization(actor, targetOrganization) && target.role !== "REQUESTER")) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado no seu escopo." });
  if (id === actor.id && (input.role || input.status === "INACTIVE")) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode reduzir o próprio acesso ou desativar a própria conta." });
  if (actor.role !== "SPC_ADMIN" && input.role === "SPC_ADMIN") throw new TRPCError({ code: "FORBIDDEN", message: "Perfil não permitido." });
  if (input.role === "SPC_ADMIN") {
    const organization = await findOrganization(target.organizationId);
    if (!organization || organization.type !== "SPC_BRASIL") throw new TRPCError({ code: "BAD_REQUEST", message: "Administradores SPC devem pertencer à organização SPC Brasil." });
  }
  try {
    await db.update(users).set({
      ...input,
      name: input.name?.trim(),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone === undefined ? undefined : normalizePhone(input.phone),
    }).where(eq(users.id, id));
  } catch (error) {
    if (String(error).includes("users_email_uq")) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este e-mail." });
    throw error;
  }
  await writeAudit({ organizationId: actor.organizationId, actorUserId: actor.id, action: "USER_UPDATED", resourceType: "user", resourceId: id, metadata: { changedFields: Object.keys(input) } });
  return { success: true as const };
}
