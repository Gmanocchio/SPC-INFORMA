import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  authChallenges,
  authSessions,
  organizations,
  users,
} from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  sendLoginCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("./email", () => ({
  sendLoginCode: mocks.sendLoginCode,
  sendPasswordResetCode: mocks.sendPasswordResetCode,
}));
vi.mock("./audit", () => ({ writeAudit: mocks.writeAudit }));

import { beginLogin, completeLogin } from "./auth-service";
import { hashPassword } from "./security";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1";
const databaseUrl = process.env.DATABASE_URL;

describe.runIf(runIntegration && Boolean(databaseUrl))(
  "2FA persistence integration",
  () => {
    const db = drizzle(databaseUrl!);
    const suffix = `${Date.now()}`.slice(-10);
    const email = `integration.2fa.${suffix}@example.invalid`;
    const cpf = `9${suffix}`.slice(0, 11).padEnd(11, "0");
    const cnpj = `99${suffix}`.slice(0, 14).padEnd(14, "0");
    const password = "Integracao2FA!2026";
    let organizationId = 0;
    let userId = 0;

    function request(ip: string) {
      return {
        ip,
        protocol: "https",
        headers: {
          "user-agent": "Vitest integration",
          "x-forwarded-proto": "https",
        },
      } as any;
    }

    function response() {
      return { cookie: vi.fn(), clearCookie: vi.fn() } as any;
    }

    beforeAll(async () => {
      await db.insert(organizations).values({
        type: "CDL",
        legalName: `Integração 2FA ${suffix}`,
        tradeName: `Integração 2FA ${suffix}`,
        cnpj,
        responsibleName: "Teste automatizado",
        responsibleEmail: email,
      });
      const [organization] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.cnpj, cnpj))
        .limit(1);
      organizationId = organization.id;

      await db.insert(users).values({
        organizationId,
        name: "Teste automatizado 2FA",
        cpf,
        email,
        passwordHash: await hashPassword(password),
        role: "REQUESTER",
        status: "ACTIVE",
        mustChangePassword: false,
      });
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      userId = user.id;
    });

    afterAll(async () => {
      if (userId) {
        await db.delete(authSessions).where(eq(authSessions.userId, userId));
        await db.delete(authChallenges).where(eq(authChallenges.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
      }
      if (organizationId) {
        await db
          .delete(organizations)
          .where(eq(organizations.id, organizationId));
      }
    });

    it("persists the issued code, consumes it once and rejects reuse", async () => {
      mocks.sendLoginCode.mockClear();
      const started = await beginLogin(
        email,
        password,
        request("203.0.113.10"),
      );
      const code = mocks.sendLoginCode.mock.calls[0]?.[1];
      expect(code).toMatch(/^\d{6}$/);

      const [persisted] = await db
        .select()
        .from(authChallenges)
        .where(
          and(
            eq(authChallenges.id, started.challengeId),
            eq(authChallenges.userId, userId),
          ),
        )
        .limit(1);
      expect(persisted).toMatchObject({
        type: "LOGIN_2FA",
        attempts: 0,
        usedAt: null,
      });

      await expect(
        completeLogin(
          started.challengeId,
          code,
          request("203.0.113.99"),
          response(),
        ),
      ).resolves.toEqual({ mustChangePassword: false });

      const [consumed] = await db
        .select({ usedAt: authChallenges.usedAt })
        .from(authChallenges)
        .where(eq(authChallenges.id, started.challengeId))
        .limit(1);
      expect(consumed.usedAt).toBeInstanceOf(Date);

      await expect(
        completeLogin(
          started.challengeId,
          code,
          request("203.0.113.99"),
          response(),
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  },
);
