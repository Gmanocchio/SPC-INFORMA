import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    getUserByEmail: vi.fn(),
    updateLoginFailure: vi.fn(),
    clearLoginFailures: vi.fn(),
    countRecentAuthChallenges: vi.fn(),
    createAuthChallenge: vi.fn(),
    consumeChallenge: vi.fn(),
    consumeOtherAuthChallenges: vi.fn(),
    getAuthChallenge: vi.fn(),
    listUsableAuthChallenges: vi.fn(),
    incrementChallengeAttempts: vi.fn(),
    getUserById: vi.fn(),
    createAuthSession: vi.fn(),
    markSignedIn: vi.fn(),
    completePasswordChange: vi.fn(),
    revokeAllSessions: vi.fn(),
  },
  sendLoginCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  writeAudit: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  createNumericCode: vi.fn(),
}));

vi.mock("./db", () => mocks.db);
vi.mock("./email", () => ({
  sendLoginCode: mocks.sendLoginCode,
  sendPasswordResetCode: mocks.sendPasswordResetCode,
}));
vi.mock("./audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("./security", async () => {
  const actual = await vi.importActual<typeof import("./security")>("./security");
  return {
    ...actual,
    createNumericCode: mocks.createNumericCode,
    verifyPassword: mocks.verifyPassword,
    hashPassword: mocks.hashPassword,
  };
});

import { beginLogin, completeLogin, completePasswordReset, requestPasswordReset } from "./auth-service";

const user = {
  id: 42,
  organizationId: 7,
  email: "operador@exemplo.com.br",
  passwordHash: "hash-atual",
  status: "ACTIVE",
  deletedAt: null,
  lockedUntil: null,
  failedLoginAttempts: 0,
  mustChangePassword: false,
};

function request() {
  return {
    ip: "203.0.113.10",
    protocol: "https",
    headers: { "user-agent": "Vitest", "x-forwarded-proto": "https" },
  } as any;
}

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.hashPassword.mockResolvedValue("hash-novo");
  mocks.createNumericCode.mockReturnValue("123456");
  mocks.db.getUserByEmail.mockResolvedValue(user);
  mocks.db.getUserById.mockResolvedValue(user);
  mocks.db.countRecentAuthChallenges.mockResolvedValue(0);
  mocks.db.consumeChallenge.mockResolvedValue(true);
  mocks.db.listUsableAuthChallenges.mockResolvedValue([]);
});

describe("authentication service flows", () => {
  it("issues a login 2FA challenge, consumes it atomically and creates an MFA session", async () => {
    let issued: any;
    mocks.db.createAuthChallenge.mockImplementation(async value => { issued = value; });

    const started = await beginLogin(" OPERADOR@EXEMPLO.COM.BR ", "SenhaAtual!2026", request());
    expect(started.challengeId).toBe(issued.id);
    expect(issued).toMatchObject({ userId: user.id, type: "LOGIN_2FA" });
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(mocks.sendLoginCode).toHaveBeenCalledWith(user.email, "123456");

    mocks.db.getAuthChallenge.mockResolvedValue({
      ...issued,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
    });
    const res = response();
    await expect(completeLogin(issued.id, "123456", request(), res)).resolves.toEqual({ mustChangePassword: false });
    expect(mocks.db.consumeChallenge).toHaveBeenCalledWith(issued.id);
    expect(mocks.db.consumeOtherAuthChallenges).toHaveBeenCalledWith(user.id, "LOGIN_2FA", issued.id);
    expect(mocks.db.createAuthSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: user.id,
      assuranceLevel: "MFA",
    }));
    expect(res.cookie).toHaveBeenCalledWith(
      "spc_notificadora_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );

    mocks.db.consumeChallenge.mockResolvedValueOnce(false);
    await expect(completeLogin(issued.id, "123456", request(), response())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.db.createAuthSession).toHaveBeenCalledTimes(1);
  });

  it("rejects an expired login challenge before consumption or session creation", async () => {
    mocks.db.getAuthChallenge.mockResolvedValue({
      id: "expirado",
      userId: user.id,
      type: "LOGIN_2FA",
      tokenHash: "irrelevante",
      requestIpHash: null,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(completeLogin("expirado", "123456", request(), response())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.db.consumeChallenge).not.toHaveBeenCalled();
    expect(mocks.db.createAuthSession).not.toHaveBeenCalled();
  });

  it("accepts a valid login code when the proxy reports a different IP during verification", async () => {
    let issued: any;
    mocks.db.createAuthChallenge.mockImplementation(async value => { issued = value; });
    await beginLogin(user.email, "SenhaAtual!2026", request());
    mocks.db.getAuthChallenge.mockResolvedValue({
      ...issued,
      requestIpHash: "contexto-legado",
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
    });

    const changedIpRequest = {
      ...request(),
      ip: "203.0.113.99",
    } as any;
    await expect(
      completeLogin(issued.id, "123456", changedIpRequest, response()),
    ).resolves.toEqual({ mustChangePassword: false });
  });

  it("accepts a valid code from another active challenge when e-mails arrive out of order", async () => {
    const issued: any[] = [];
    mocks.db.createAuthChallenge.mockImplementation(async value => { issued.push(value); });
    mocks.createNumericCode.mockReturnValueOnce("111111").mockReturnValueOnce("222222");

    await beginLogin(user.email, "SenhaAtual!2026", request());
    await beginLogin(user.email, "SenhaAtual!2026", request());
    const [older, newest] = issued.map(challenge => ({
      ...challenge,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
    }));
    mocks.db.getAuthChallenge.mockResolvedValue(newest);
    mocks.db.listUsableAuthChallenges.mockResolvedValue([newest, older]);

    await expect(
      completeLogin(newest.id, "111111", request(), response()),
    ).resolves.toEqual({ mustChangePassword: false });
    expect(mocks.db.consumeChallenge).toHaveBeenCalledWith(older.id);
    expect(mocks.db.consumeOtherAuthChallenges).toHaveBeenCalledWith(user.id, "LOGIN_2FA", older.id);
  });

  it("increments attempts and rejects a code that matches no active challenge", async () => {
    let issued: any;
    mocks.db.createAuthChallenge.mockImplementation(async value => { issued = value; });
    await beginLogin(user.email, "SenhaAtual!2026", request());
    mocks.db.getAuthChallenge.mockResolvedValue({
      ...issued,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
    });

    await expect(
      completeLogin(issued.id, "999999", request(), response()),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.db.incrementChallengeAttempts).toHaveBeenCalledWith(issued.id);
    expect(mocks.db.createAuthSession).not.toHaveBeenCalled();
  });

  it("issues and consumes a password-reset challenge, changes the password and revokes existing sessions", async () => {
    let issued: any;
    mocks.db.createAuthChallenge.mockImplementation(async value => { issued = value; });

    const started = await requestPasswordReset(user.email, request());
    expect(started.requestId).toBe(issued.id);
    expect(issued).toMatchObject({ userId: user.id, type: "PASSWORD_RESET" });
    expect(mocks.sendPasswordResetCode).toHaveBeenCalledWith(user.email, "123456");

    mocks.db.getAuthChallenge.mockResolvedValue({
      ...issued,
      attempts: 0,
      maxAttempts: 5,
      usedAt: null,
    });
    await expect(completePasswordReset(issued.id, "123456", "SenhaNova!2026", request())).resolves.toEqual({ success: true });
    expect(mocks.db.completePasswordChange).toHaveBeenCalledWith(user.id, "hash-novo");
    expect(mocks.db.revokeAllSessions).toHaveBeenCalledWith(user.id);

    mocks.db.consumeChallenge.mockResolvedValueOnce(false);
    await expect(completePasswordReset(issued.id, "123456", "SenhaNova!2026", request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.db.completePasswordChange).toHaveBeenCalledTimes(1);
  });
});
