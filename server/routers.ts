import { z } from "zod";
import {
  beginLogin,
  changeFirstAccessPassword,
  completeLogin,
  completePasswordReset,
  logoutCurrentSession,
  requestPasswordReset,
} from "./auth-service";
import { systemRouter } from "./_core/systemRouter";
import { authenticatedProcedure, publicProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { commercialRouter } from "./routers/commercial";
import { campaignsRouter } from "./routers/campaigns";
import { brokersRouter } from "./routers/brokers";
import { dashboardRouter } from "./routers/dashboard";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(1).max(128);
const newPasswordSchema = z.string().min(12).max(128);
const challengeIdSchema = z.string().min(24).max(128);
const codeSchema = z.string().trim().regex(/^\d{6}$/);

export const appRouter = router({
  system: systemRouter,
  admin: adminRouter,
  commercial: commercialRouter,
  campaigns: campaignsRouter,
  brokers: brokersRouter,
  dashboard: dashboardRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user || !ctx.organization || !ctx.session) return null;
      return {
        user: {
          id: ctx.user.id,
          organizationId: ctx.user.organizationId,
          name: ctx.user.name,
          email: ctx.user.email,
          phone: ctx.user.phone,
          role: ctx.user.role,
          status: ctx.user.status,
          mustChangePassword: ctx.user.mustChangePassword,
          lastSignedIn: ctx.user.lastSignedIn,
        },
        organization: {
          id: ctx.organization.id,
          type: ctx.organization.type,
          tradeName: ctx.organization.tradeName,
          billingModel: ctx.organization.billingModel,
          status: ctx.organization.status,
        },
        assuranceLevel: ctx.session.assuranceLevel,
      };
    }),
    login: publicProcedure
      .input(z.object({ email: emailSchema, password: passwordSchema }))
      .mutation(async ({ ctx, input }) => {
        const result = await beginLogin(input.email, input.password, ctx.req);
        return {
          challengeId: result.challengeId,
          emailHint: result.maskedEmail,
          expiresInSeconds: result.expiresInSeconds,
        };
      }),
    verifyTwoFactor: publicProcedure
      .input(
        z.object({ challengeId: challengeIdSchema, code: codeSchema }),
      )
      .mutation(async ({ ctx, input }) => {
        const result = await completeLogin(
          input.challengeId,
          input.code,
          ctx.req,
          ctx.res,
        );
        return {
          success: true as const,
          mustChangePassword: result.mustChangePassword,
        };
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: emailSchema }))
      .mutation(async ({ ctx, input }) => {
        const result = await requestPasswordReset(input.email, ctx.req);
        return {
          success: true as const,
          requestId: result.requestId,
          expiresInSeconds: result.expiresInSeconds,
          message:
            "Se a conta estiver ativa, as instruções serão enviadas por e-mail.",
        };
      }),
    resetPassword: publicProcedure
      .input(
        z.object({
          requestId: challengeIdSchema,
          code: codeSchema,
          newPassword: newPasswordSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await completePasswordReset(
          input.requestId,
          input.code,
          input.newPassword,
          ctx.req,
        );
        return { success: true as const };
      }),
    changeFirstAccessPassword: authenticatedProcedure
      .input(
        z.object({
          currentPassword: passwordSchema,
          newPassword: newPasswordSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await changeFirstAccessPassword(
          ctx.user.id,
          ctx.session.id,
          input.currentPassword,
          input.newPassword,
        );
        return { success: true as const, requiresNewLogin: false as const };
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await logoutCurrentSession(
        ctx.session?.id ?? null,
        ctx.req,
        ctx.res,
        ctx.user
          ? { id: ctx.user.id, organizationId: ctx.user.organizationId }
          : undefined,
      );
      return { success: true as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
