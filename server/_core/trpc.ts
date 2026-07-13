import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || !ctx.organization || !ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sua sessão é inválida ou expirou.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organization: ctx.organization,
      session: ctx.session,
    },
  });
});

const requireMfa = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user || !ctx.organization || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão inválida." });
  }
  if (
    ctx.session.assuranceLevel !== "MFA" ||
    ctx.user.mustChangePassword
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Conclua a troca obrigatória de senha para continuar.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organization: ctx.organization,
      session: ctx.session,
      organizationId: ctx.user.organizationId,
    },
  });
});

export const authenticatedProcedure = t.procedure.use(requireUser);
export const protectedProcedure = authenticatedProcedure.use(requireMfa);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !["SPC_ADMIN", "ORG_ADMIN"].includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso restrito a administradores.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        organization: ctx.organization,
        session: ctx.session,
        organizationId: ctx.user.organizationId,
      },
    });
  }),
);

export const spcAdminProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "SPC_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso exclusivo ao Administrador SPC Brasil.",
      });
    }
    return next({ ctx });
  }),
);
