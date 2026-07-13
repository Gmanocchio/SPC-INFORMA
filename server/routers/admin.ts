import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { isValidCnpj, isValidCpf } from "../br-validation";
import { createOrganization, createUser, listOrganizations, listUsers, updateOrganization, updateUser, uploadOrganizationLogo } from "../admin-service";

const organizationType = z.enum(["SPC_BRASIL", "CDL", "DISTRIBUTOR", "CREDITOR"]);
const userRole = z.enum(["SPC_ADMIN", "ORG_ADMIN", "REQUESTER"]);
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const actor = (ctx: { user: { id: number; organizationId: number; role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" } }) => ({ id: ctx.user.id, organizationId: ctx.user.organizationId, role: ctx.user.role });

const organizationFields = {
  legalName: z.string().trim().min(2).max(180),
  tradeName: z.string().trim().min(2).max(180),
  responsibleName: z.string().trim().min(2).max(160),
  responsibleEmail: z.string().trim().email().max(320),
  responsiblePhone: nullableText(20),
  postalCode: nullableText(9),
  street: nullableText(180),
  streetNumber: nullableText(30),
  addressExtra: nullableText(100),
  district: nullableText(100),
  city: nullableText(120),
  state: z.string().trim().length(2).nullable().optional(),
  billingModel: z.enum(["PREPAID", "POSTPAID"]),
  balanceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  creditLimitCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
};

export const adminRouter = router({
  organizations: router({
    list: adminProcedure.input(z.object({ search: z.string().trim().max(120).optional(), type: organizationType.optional() })).query(({ ctx, input }) => listOrganizations(actor(ctx), input)),
    create: adminProcedure.input(z.object({ parentOrganizationId: z.number().int().positive().nullable().optional(), type: organizationType, cnpj: z.string().refine(isValidCnpj, "CNPJ inválido."), ...organizationFields })).mutation(({ ctx, input }) => createOrganization(actor(ctx), input)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ ...organizationFields, status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional() }).partial() })).mutation(({ ctx, input }) => updateOrganization(actor(ctx), input.id, input.data)),
    uploadLogo: adminProcedure.input(z.object({ id: z.number().int().positive(), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().min(16).max(1_500_000) })).mutation(({ ctx, input }) => uploadOrganizationLogo(actor(ctx), input.id, input.mimeType, input.base64)),
  }),
  users: router({
    list: adminProcedure.input(z.object({ organizationId: z.number().int().positive().optional(), search: z.string().trim().max(120).optional() })).query(({ ctx, input }) => listUsers(actor(ctx), input)),
    create: adminProcedure.input(z.object({ organizationId: z.number().int().positive(), name: z.string().trim().min(2).max(160), cpf: z.string().refine(isValidCpf, "CPF inválido."), email: z.string().trim().email().max(320), phone: nullableText(20), initialPassword: z.string().min(12).max(128), role: userRole })).mutation(({ ctx, input }) => createUser(actor(ctx), input)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().trim().min(2).max(160).optional(), phone: nullableText(20), role: userRole.optional(), status: z.enum(["INVITED", "ACTIVE", "INACTIVE", "LOCKED"]).optional() }) })).mutation(({ ctx, input }) => updateUser(actor(ctx), input.id, input.data)),
  }),
});
