import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { campaignDetails, campaignImportLayout, confirmCampaign, createCampaignFromFile, listCampaignOptions, listCampaigns } from "../campaign-service";

const channel = z.enum(["SMS", "EMAIL", "WHATSAPP", "RCS"]);
const actor = (ctx: { user: { id: number; organizationId: number; role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" } | null }) => {
  if (!ctx.user) throw new Error("Contexto autenticado obrigatório.");
  return { id: ctx.user.id, organizationId: ctx.user.organizationId, role: ctx.user.role };
};

export const campaignsRouter = router({
  options: protectedProcedure.query(({ ctx }) => listCampaignOptions(actor(ctx))),
  layout: protectedProcedure.input(z.object({ channel })).query(({ input }) => campaignImportLayout(input.channel)),
  list: protectedProcedure.query(({ ctx }) => listCampaigns(actor(ctx))),
  details: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(({ ctx, input }) => campaignDetails(actor(ctx), input.id)),
  import: protectedProcedure.input(z.object({ organizationId: z.number().int().positive().optional(), creditorOrganizationId: z.number().int().positive(), templateId: z.number().int().positive(), name: z.string().trim().min(3).max(180), channel, filename: z.string().trim().min(1).max(255), mimeType: z.enum(["text/csv", "application/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]), base64: z.string().min(1).max(12_000_000), scheduledFor: z.coerce.date().nullable().optional(), idempotencyKey: z.string().uuid() })).mutation(({ ctx, input }) => createCampaignFromFile(actor(ctx), input)),
  confirm: protectedProcedure.input(z.object({ id: z.string().uuid(), confirm: z.literal(true) })).mutation(({ ctx, input }) => confirmCampaign(actor(ctx), input.id, input.confirm)),
});
