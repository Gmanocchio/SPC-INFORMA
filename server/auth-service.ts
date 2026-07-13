import type { Request, Response } from "express";
import { parse as parseCookies } from "cookie";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { sendLoginCode, sendPasswordResetCode } from "./email";
import {
  assertStrongPassword,
  createNumericCode,
  createOpaqueToken,
  hashNetworkValue,
  hashPassword,
  hmacToken,
  normalizeEmail,
  safeTokenEqual,
  sha256,
  verifyPassword,
} from "./security";
import { ENV } from "./_core/env";
import { writeAudit } from "./audit";

export const APP_SESSION_COOKIE = "spc_notificadora_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_CHALLENGES = 5;
const MAX_RESET_CHALLENGES = 3;
const DUMMY_PASSWORD_HASH = `scrypt$32768$8$2$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

export type AppSession = NonNullable<
  Awaited<ReturnType<typeof db.getSessionWithUserByTokenHash>>
>["session"];

function requestIp(req: Request) {
  return req.ip;
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const secure =
    ENV.isProduction ||
    req.protocol === "https" ||
    forwardedProto === "https";
  res.cookie(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  res.clearCookie(APP_SESSION_COOKIE, {
    httpOnly: true,
    secure:
      ENV.isProduction || req.protocol === "https" || forwardedProto === "https",
    sameSite: "lax",
    path: "/",
  });
}

function challengeHash(id: string, code: string) {
  return hmacToken(`${id}:${code}`, ENV.cookieSecret);
}

function invalidCredentials(): never {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "E-mail ou senha inválidos.",
  });
}

export function isAccountLockActive(
  status: string,
  lockedUntil: Date | null,
  now = Date.now(),
) {
  return status === "LOCKED" && (!lockedUntil || lockedUntil.getTime() > now);
}

export function matchesBoundContext(
  expectedHash: string | null,
  currentHash: string | null,
) {
  return !expectedHash || Boolean(currentHash && safeTokenEqual(currentHash, expectedHash));
}

export function isUsableAuthChallenge(
  challenge: {
    type: string;
    usedAt: Date | null;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
  } | null | undefined,
  expectedType: "LOGIN_2FA" | "PASSWORD_RESET",
  now = Date.now(),
) {
  return Boolean(
    challenge
      && challenge.type === expectedType
      && !challenge.usedAt
      && challenge.expiresAt.getTime() > now
      && challenge.attempts < challenge.maxAttempts,
  );
}

export async function beginLogin(
  emailInput: string,
  password: string,
  req: Request,
) {
  const email = normalizeEmail(emailInput);
  const user = await db.getUserByEmail(email);

  if (!user || user.deletedAt || user.status === "INACTIVE") {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    invalidCredentials();
  }

  const lockExpired = user.status === "LOCKED" && user.lockedUntil && user.lockedUntil.getTime() <= Date.now();
  if (isAccountLockActive(user.status, user.lockedUntil)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Acesso temporariamente bloqueado. Tente novamente mais tarde.",
    });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    const attempts = (lockExpired ? 0 : user.failedLoginAttempts) + 1;
    const shouldLock = attempts >= MAX_LOGIN_FAILURES;
    await db.updateLoginFailure(
      user.id,
      attempts,
      shouldLock ? new Date(Date.now() + LOCK_MS) : null,
    );
    await writeAudit({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: shouldLock ? "LOGIN_LOCKED" : "LOGIN_FAILED",
      resourceType: "auth_session",
      resourceId: user.id,
      metadata: { attempts },
    });
    invalidCredentials();
  }

  await db.clearLoginFailures(user.id);

  const recentChallenges = await db.countRecentAuthChallenges(
    user.id,
    "LOGIN_2FA",
    new Date(Date.now() - AUTH_RATE_WINDOW_MS),
  );
  if (recentChallenges >= MAX_LOGIN_CHALLENGES) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas de acesso. Aguarde alguns minutos.",
    });
  }

  const id = createOpaqueToken(24);
  const code = createNumericCode();
  await db.createAuthChallenge({
    id,
    userId: user.id,
    type: "LOGIN_2FA",
    tokenHash: challengeHash(id, code),
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    requestIpHash: hashNetworkValue(requestIp(req), ENV.cookieSecret),
  });

  try {
    await sendLoginCode(user.email, code);
  } catch (error) {
    await db.consumeChallenge(id);
    console.error("[Auth] SendGrid login code failed", {
      challengeId: id,
      error: String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Não foi possível enviar o código de acesso. Tente novamente.",
    });
  }

  await writeAudit({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "LOGIN_2FA_ISSUED",
    resourceType: "auth_challenge",
    resourceId: id,
  });

  return {
    challengeId: id,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: CHALLENGE_TTL_MS / 1000,
  };
}

export async function completeLogin(
  challengeId: string,
  code: string,
  req: Request,
  res: Response,
) {
  const challenge = await db.getAuthChallenge(challengeId);
  if (!isUsableAuthChallenge(challenge, "LOGIN_2FA")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Código inválido ou expirado.",
    });
  }

  const actual = challengeHash(challenge.id, code);
  const currentIpHash = hashNetworkValue(requestIp(req), ENV.cookieSecret);
  if (!matchesBoundContext(challenge.requestIpHash, currentIpHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou expirado." });
  }
  if (!safeTokenEqual(actual, challenge.tokenHash)) {
    await db.incrementChallengeAttempts(challenge.id);
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
  }

  const user = await db.getUserById(challenge.userId);
  if (!user || user.status === "INACTIVE" || user.deletedAt) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso indisponível." });
  }

  if (!(await db.consumeChallenge(challenge.id))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou expirado." });
  }
  const token = createOpaqueToken();
  const sessionId = createOpaqueToken(24);
  await db.createAuthSession({
    id: sessionId,
    userId: user.id,
    tokenHash: sha256(token),
    assuranceLevel: user.mustChangePassword ? "PASSWORD_CHANGE" : "MFA",
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ipHash: hashNetworkValue(requestIp(req), ENV.cookieSecret),
    userAgentHash: hashNetworkValue(req.headers["user-agent"], ENV.cookieSecret),
  });
  await db.markSignedIn(user.id);
  setSessionCookie(req, res, token);
  await writeAudit({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "LOGIN_SUCCEEDED",
    resourceType: "auth_session",
    resourceId: sessionId,
    metadata: { assuranceLevel: user.mustChangePassword ? "PASSWORD_CHANGE" : "MFA" },
  });

  return { mustChangePassword: user.mustChangePassword };
}

export async function getAuthenticatedSession(req: Request) {
  const token = parseCookies(req.headers.cookie || "")[APP_SESSION_COOKIE];
  if (!token) return null;
  const result = await db.getSessionWithUserByTokenHash(sha256(token));
  if (
    !result ||
    result.session.revokedAt ||
    result.session.expiresAt.getTime() <= Date.now() ||
    result.user.status !== "ACTIVE" ||
    result.user.deletedAt
  ) {
    return null;
  }
  const currentAgentHash = hashNetworkValue(req.headers["user-agent"], ENV.cookieSecret);
  if (!matchesBoundContext(result.session.userAgentHash, currentAgentHash)) {
    await db.revokeSession(result.session.id);
    return null;
  }
  return result;
}

export async function logoutCurrentSession(
  sessionId: string | null,
  req: Request,
  res: Response,
  actor?: { id: number; organizationId: number },
) {
  if (sessionId) await db.revokeSession(sessionId);
  clearSessionCookie(req, res);
  if (sessionId && actor) {
    await writeAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: "LOGOUT",
      resourceType: "auth_session",
      resourceId: sessionId,
    });
  }
}

export async function changeFirstAccessPassword(
  userId: number,
  sessionId: string,
  currentPassword: string,
  nextPassword: string,
) {
  assertStrongPassword(nextPassword);
  const user = await db.getUserById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A senha atual não confere.",
    });
  }
  if (await verifyPassword(nextPassword, user.passwordHash)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A nova senha deve ser diferente da senha atual.",
    });
  }
  await db.completePasswordChange(user.id, await hashPassword(nextPassword));
  await db.revokeOtherSessions(user.id, sessionId);
  await db.upgradeSessionToMfa(sessionId);
  await writeAudit({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "FIRST_ACCESS_PASSWORD_CHANGED",
    resourceType: "user",
    resourceId: user.id,
  });
  return { success: true as const };
}

export async function requestPasswordReset(emailInput: string, req: Request) {
  const email = normalizeEmail(emailInput);
  const user = await db.getUserByEmail(email);
  const fallbackId = createOpaqueToken(24);
  if (!user || user.deletedAt || user.status === "INACTIVE") {
    return { requestId: fallbackId, expiresInSeconds: RESET_TTL_MS / 1000 };
  }

  const id = createOpaqueToken(24);
  const code = createNumericCode();
  const recentChallenges = await db.countRecentAuthChallenges(
    user.id,
    "PASSWORD_RESET",
    new Date(Date.now() - AUTH_RATE_WINDOW_MS),
  );
  if (recentChallenges >= MAX_RESET_CHALLENGES) {
    return { requestId: fallbackId, expiresInSeconds: RESET_TTL_MS / 1000 };
  }
  await db.createAuthChallenge({
    id,
    userId: user.id,
    type: "PASSWORD_RESET",
    tokenHash: challengeHash(id, code),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    requestIpHash: hashNetworkValue(requestIp(req), ENV.cookieSecret),
  });

  try {
    await sendPasswordResetCode(user.email, code);
  } catch (error) {
    await db.consumeChallenge(id);
    console.error("[Auth] SendGrid password reset failed", {
      challengeId: id,
      error: String(error),
    });
  }

  await writeAudit({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    resourceType: "auth_challenge",
    resourceId: id,
  });

  return { requestId: id, expiresInSeconds: RESET_TTL_MS / 1000 };
}

export async function completePasswordReset(
  requestId: string,
  code: string,
  nextPassword: string,
  req: Request,
) {
  assertStrongPassword(nextPassword);
  const challenge = await db.getAuthChallenge(requestId);
  if (!isUsableAuthChallenge(challenge, "PASSWORD_RESET")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Código inválido ou expirado.",
    });
  }

  const actual = challengeHash(challenge.id, code);
  const currentIpHash = hashNetworkValue(requestIp(req), ENV.cookieSecret);
  if (!matchesBoundContext(challenge.requestIpHash, currentIpHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou expirado." });
  }
  if (!safeTokenEqual(actual, challenge.tokenHash)) {
    await db.incrementChallengeAttempts(challenge.id);
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
  }

  if (!(await db.consumeChallenge(challenge.id))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou expirado." });
  }
  await db.completePasswordChange(challenge.userId, await hashPassword(nextPassword));
  await db.revokeAllSessions(challenge.userId);
  const user = await db.getUserById(challenge.userId);
  if (user) {
    await writeAudit({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
      resourceType: "user",
      resourceId: user.id,
    });
  }
  return { success: true as const };
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}
