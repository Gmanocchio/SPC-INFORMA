import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getAuthenticatedSession } from "../auth-service";

type AuthenticatedIdentity = Awaited<ReturnType<typeof getAuthenticatedSession>>;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: NonNullable<AuthenticatedIdentity>["user"] | null;
  organization: NonNullable<AuthenticatedIdentity>["organization"] | null;
  session: NonNullable<AuthenticatedIdentity>["session"] | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let identity: AuthenticatedIdentity = null;

  try {
    identity = await getAuthenticatedSession(opts.req);
  } catch (error) {
    console.warn("[Auth] Não foi possível validar a sessão atual.");
  }

  return {
    req: opts.req,
    res: opts.res,
    user: identity?.user ?? null,
    organization: identity?.organization ?? null,
    session: identity?.session ?? null,
  };
}
