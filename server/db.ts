import { and, count, desc, eq, gt, gte, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  authChallenges,
  authSessions,
  organizations,
  users,
} from "../drizzle/schema";
import { loadRetentionPolicy, retentionCutoff } from "./retention-config";

type User = typeof users.$inferSelect;
type InsertAuthChallenge = typeof authChallenges.$inferInsert;
type InsertAuthSession = typeof authSessions.$inferInsert;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

export async function getUserByEmail(email: string) {
  const db = await requireDb();
  return (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
}

export async function getUserById(id: number) {
  const db = await requireDb();
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  return (
    await db.select().from(users).where(eq(users.openId, openId)).limit(1)
  )[0];
}

export async function upsertUser(input: Partial<User> & { openId: string }) {
  const existing = await getUserByOpenId(input.openId);
  if (!existing) {
    throw new Error(
      "Provisionamento OAuth está desabilitado; crie o usuário pelo painel.",
    );
  }
  const db = await requireDb();
  await db
    .update(users)
    .set({
      lastSignedIn: input.lastSignedIn ?? new Date(),
      ...(input.name ? { name: input.name } : {}),
    })
    .where(eq(users.id, existing.id));
}

export async function updateLoginFailure(
  userId: number,
  attempts: number,
  lockedUntil: Date | null,
) {
  const db = await requireDb();
  await db
    .update(users)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil,
      ...(lockedUntil ? { status: "LOCKED" as const } : {}),
    })
    .where(eq(users.id, userId));
}

export async function clearLoginFailures(userId: number) {
  const db = await requireDb();
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, status: "ACTIVE" })
    .where(eq(users.id, userId));
}

export async function markSignedIn(userId: number) {
  const db = await requireDb();
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function createAuthChallenge(input: InsertAuthChallenge) {
  const db = await requireDb();
  await db.insert(authChallenges).values(input);
}

export async function countRecentAuthChallenges(
  userId: number,
  type: InsertAuthChallenge["type"],
  since: Date,
) {
  const db = await requireDb();
  const [result] = await db
    .select({ total: count() })
    .from(authChallenges)
    .where(and(eq(authChallenges.userId, userId), eq(authChallenges.type, type), gte(authChallenges.createdAt, since)));
  return Number(result?.total ?? 0);
}

export async function getAuthChallenge(id: string) {
  const db = await requireDb();
  return (
    await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, id))
      .limit(1)
  )[0];
}

export async function incrementChallengeAttempts(id: string) {
  const db = await requireDb();
  await db
    .update(authChallenges)
    .set({ attempts: sql`${authChallenges.attempts} + 1` })
    .where(and(eq(authChallenges.id, id), isNull(authChallenges.usedAt)));
}

export async function consumeChallenge(id: string) {
  const db = await requireDb();
  const result = await db
    .update(authChallenges)
    .set({ usedAt: new Date() })
    .where(and(eq(authChallenges.id, id), isNull(authChallenges.usedAt)));
  return Number(result[0].affectedRows) === 1;
}

export async function cleanupExpiredAuthArtifacts(now = new Date()) {
  const db = await requireDb();
  const policy = loadRetentionPolicy();
  const challengeCutoff = retentionCutoff(now, policy.authChallengeDays);
  const sessionCutoff = retentionCutoff(now, policy.authSessionDays);
  await db.delete(authChallenges).where(lt(authChallenges.expiresAt, challengeCutoff));
  await db.delete(authSessions).where(or(lt(authSessions.expiresAt, sessionCutoff), and(isNotNull(authSessions.revokedAt), lt(authSessions.revokedAt, sessionCutoff))));
}

export async function createAuthSession(input: InsertAuthSession) {
  const db = await requireDb();
  await db.insert(authSessions).values(input);
}

export async function getSessionWithUserByTokenHash(tokenHash: string) {
  const db = await requireDb();
  return (
    await db
      .select({
        session: authSessions,
        user: users,
        organization: organizations,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
  )[0];
}

export async function revokeSession(id: string) {
  const db = await requireDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, id));
}

export async function revokeAllSessions(userId: number) {
  const db = await requireDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export async function revokeOtherSessions(userId: number, currentId: string) {
  const db = await requireDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.userId, userId),
        ne(authSessions.id, currentId),
        isNull(authSessions.revokedAt),
      ),
    );
}

export async function upgradeSessionToMfa(id: string) {
  const db = await requireDb();
  await db
    .update(authSessions)
    .set({ assuranceLevel: "MFA", lastSeenAt: new Date() })
    .where(eq(authSessions.id, id));
}

export async function completePasswordChange(
  userId: number,
  passwordHash: string,
) {
  const db = await requireDb();
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      status: "ACTIVE",
    })
    .where(eq(users.id, userId));
}

export async function listActiveSessions(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(authSessions.createdAt));
}
