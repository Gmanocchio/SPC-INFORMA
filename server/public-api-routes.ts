import type { Express, Request } from "express";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticateApiKey } from "./api-key-service";
import { createEmailCampaignFromApi } from "./campaign-service";

const recipientSchema = z.object({
  cpf: z.string().trim().min(11).max(18),
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().email().max(320),
  creditorName: z.string().trim().min(1).max(160),
  amount: z.union([z.string().trim().min(1).max(40), z.number().positive()]),
  dueDate: z.string().trim().min(8).max(10),
  contractNumber: z.string().trim().min(1).max(120),
  creditorPhone: z.string().trim().min(10).max(120),
  creditorEmail: z.string().trim().email().max(320),
  link: z.string().trim().url().max(2048),
}).strict();

const campaignSchema = z.object({
  creditorOrganizationId: z.number().int().positive(),
  templateId: z.number().int().positive(),
  name: z.string().trim().min(3).max(180),
  idempotencyKey: z.string().uuid(),
  scheduledFor: z.coerce.date().nullable().optional(),
  recipients: z.array(recipientSchema).min(1).max(20_000),
}).strict();

function apiKeyFrom(req: Request) {
  const direct = req.header("x-api-key")?.trim();
  if (direct) return direct;
  const authorization = req.header("authorization")?.trim() ?? "";
  return /^Bearer\s+/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, "").trim() : "";
}

function statusFor(error: unknown) {
  if (!(error instanceof TRPCError)) return 500;
  return ({
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    BAD_REQUEST: 422,
    CONFLICT: 409,
    NOT_FOUND: 404,
    PRECONDITION_FAILED: 412,
  } as const)[error.code as "UNAUTHORIZED"] ?? 500;
}

export function registerPublicApiRoutes(app: Express) {
  app.post("/api/v1/campaigns/email", async (req, res) => {
    try {
      const key = await authenticateApiKey(apiKeyFrom(req), "campaigns:write");
      const input = campaignSchema.parse(req.body);
      const result = await createEmailCampaignFromApi({
        id: key.createdByUserId,
        organizationId: key.organizationId,
        role: "ORG_ADMIN",
      }, input);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(422).json({ error: "INVALID_INPUT", details: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
        return;
      }
      const status = statusFor(error);
      res.status(status).json({
        error: error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR",
        message: status === 500 ? "Não foi possível processar a solicitação." : error instanceof Error ? error.message : "Solicitação inválida.",
      });
    }
  });
}
