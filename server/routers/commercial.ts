import { z } from "zod";
import { adminProcedure, protectedProcedure, router, spcAdminProcedure } from "../_core/trpc";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "../api-key-service";
import { listPricing, listPricingOrganizations, setBasePrice, setCreditorPrice } from "../pricing-service";
import { createTemplate, listAvailableTemplates, listTemplates, updateTemplate } from "../template-service";

const channel = z.enum(["SMS", "EMAIL", "WHATSAPP", "RCS"]);
const actor = (ctx: { user: { id: number; organizationId: number; role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" } | null }) => {
  if (!ctx.user) throw new Error("Contexto autenticado obrigatório.");
  return { id: ctx.user.id, organizationId: ctx.user.organizationId, role: ctx.user.role };
};
const templateFields = z.object({ name: z.string().trim().min(3).max(160), channel, subject: z.string().trim().max(255).nullable().optional(), content: z.string().trim().min(1).max(100_000), status: z.enum(["DRAFT", "ACTIVE"]) });
const priceFields = z.object({ channel, unitPriceMicros: z.number().int().min(0).max(100_000_000), validFrom: z.coerce.date() });

export const commercialRouter = router({
  templates: router({
    available: protectedProcedure.input(z.object({ channel: channel.optional() }).optional()).query(({ ctx, input }) => listAvailableTemplates(actor(ctx), input?.channel)),
    list: spcAdminProcedure.query(({ ctx }) => listTemplates(actor(ctx))),
    create: spcAdminProcedure.input(templateFields).mutation(({ ctx, input }) => createTemplate(actor(ctx), input)),
    update: spcAdminProcedure.input(templateFields.extend({ id: z.number().int().positive(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) })).mutation(({ ctx, input }) => updateTemplate(actor(ctx), input.id, input)),
  }),
  pricing: router({
    organizations: adminProcedure.query(({ ctx }) => listPricingOrganizations(actor(ctx))),
    list: adminProcedure.query(({ ctx }) => listPricing(actor(ctx))),
    setBase: spcAdminProcedure.input(priceFields).mutation(({ ctx, input }) => setBasePrice(actor(ctx), input)),
    setCreditor: adminProcedure.input(priceFields.extend({ organizationId: z.number().int().positive().optional(), creditorOrganizationId: z.number().int().positive() })).mutation(({ ctx, input }) => setCreditorPrice(actor(ctx), input)),
  }),
  apiKeys: router({
    list: adminProcedure.input(z.object({ organizationId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listApiKeys(actor(ctx), input?.organizationId)),
    create: adminProcedure.input(z.object({ organizationId: z.number().int().positive().optional(), name: z.string().trim().min(3).max(160), scopes: z.array(z.enum(["campaigns:read", "campaigns:write", "reports:read"])).min(1).max(3), expiresAt: z.coerce.date().nullable().optional() })).mutation(({ ctx, input }) => createApiKey(actor(ctx), input)),
    rotate: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(3).max(160), scopes: z.array(z.enum(["campaigns:read", "campaigns:write", "reports:read"])).min(1).max(3), expiresAt: z.coerce.date().nullable().optional() })).mutation(({ ctx, input }) => rotateApiKey(actor(ctx), input.id, input)),
    revoke: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => revokeApiKey(actor(ctx), input.id)),
  }),
});
