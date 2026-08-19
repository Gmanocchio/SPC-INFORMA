import { z } from "zod";
import { spcAdminProcedure, router } from "../_core/trpc";
import { createBroker, deactivateBroker, getMessageCenterCallbackConfig, listBrokers, updateBroker } from "../broker-service";

const channel = z.enum(["SMS", "EMAIL", "WHATSAPP", "RCS"]);
const credentials = z.record(z.string().trim().min(1).max(60).regex(/^[A-Za-z][A-Za-z0-9_-]*$/), z.string().max(4096)).refine(value => Object.keys(value).length <= 20, "Limite de 20 credenciais por broker.");
const extraConfig = z.record(z.string().trim().min(1).max(60), z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()])).refine(value => Object.keys(value).length <= 30, "Limite de 30 configurações extras.");
const endpointUrl = z.string().trim().url().max(2048).refine(value => value.startsWith("https://"), "O endpoint deve usar HTTPS.");
const actor = (ctx: { user: { id: number; organizationId: number; role: "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" } | null }) => {
  if (!ctx.user) throw new Error("Contexto autenticado obrigatório.");
  return { id: ctx.user.id, organizationId: ctx.user.organizationId, role: ctx.user.role };
};

export const brokersRouter = router({
  list: spcAdminProcedure.query(({ ctx }) => listBrokers(actor(ctx))),
  create: spcAdminProcedure.input(z.object({ name: z.string().trim().min(2).max(160), channel, endpointUrl, active: z.boolean(), preferred: z.boolean(), credentials, extraConfig: extraConfig.optional() })).mutation(({ ctx, input }) => createBroker(actor(ctx), input)),
  update: spcAdminProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().trim().min(2).max(160).optional(), channel: channel.optional(), endpointUrl: endpointUrl.optional(), active: z.boolean().optional(), preferred: z.boolean().optional(), credentials: credentials.optional(), extraConfig: extraConfig.optional() }) })).mutation(({ ctx, input }) => updateBroker(actor(ctx), input.id, input.data)),
  deactivate: spcAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deactivateBroker(actor(ctx), input.id)),
  messageCenterCallback: spcAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => getMessageCenterCallbackConfig(actor(ctx), input.id)),
});
