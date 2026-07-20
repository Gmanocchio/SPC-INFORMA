import { describe, expect, it } from "vitest";
import { isAccountLockActive, isUsableAuthChallenge, matchesBoundContext } from "./auth-service";
import { isTrustedMutationOrigin } from "./http-security";
import { hmacToken } from "./security";

function request(origin: string | undefined, host: string, cookie?: string) {
  const values: Record<string, string | undefined> = {
    origin,
    host,
    "x-forwarded-host": undefined,
  };
  return {
    headers: { cookie },
    get(name: string) {
      return values[name.toLowerCase()];
    },
  } as never;
}

describe("endurecimento de autenticação", () => {
  it("mantém bloqueio administrativo sem prazo e libera bloqueio temporário expirado", () => {
    expect(isAccountLockActive("LOCKED", null, 1_000)).toBe(true);
    expect(isAccountLockActive("LOCKED", new Date(2_000), 1_000)).toBe(true);
    expect(isAccountLockActive("LOCKED", new Date(500), 1_000)).toBe(false);
    expect(isAccountLockActive("ACTIVE", null, 1_000)).toBe(false);
  });

  it("aceita apenas o mesmo contexto criptograficamente vinculado", () => {
    const expected = hmacToken("contexto-a", "segredo");
    expect(matchesBoundContext(expected, expected)).toBe(true);
    expect(matchesBoundContext(expected, hmacToken("contexto-b", "segredo"))).toBe(false);
    expect(matchesBoundContext(expected, null)).toBe(false);
    expect(matchesBoundContext(null, null)).toBe(true);
  });

  it("aceita somente desafios do tipo esperado, não expirados, não usados e dentro do limite", () => {
    const valid = {
      type: "LOGIN_2FA",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
    };
    expect(isUsableAuthChallenge(valid, "LOGIN_2FA")).toBe(true);
    expect(isUsableAuthChallenge({ ...valid, type: "PASSWORD_RESET" }, "LOGIN_2FA")).toBe(false);
    expect(isUsableAuthChallenge({ ...valid, usedAt: new Date() }, "LOGIN_2FA")).toBe(false);
    expect(isUsableAuthChallenge({ ...valid, expiresAt: new Date(Date.now() - 1) }, "LOGIN_2FA")).toBe(false);
    expect(isUsableAuthChallenge({ ...valid, attempts: 5 }, "LOGIN_2FA")).toBe(false);
  });
});

describe("proteção de origem das mutações", () => {
  it("aceita a origem da própria aplicação e rejeita origem externa", () => {
    expect(isTrustedMutationOrigin(request("https://app.spc.test", "app.spc.test"))).toBe(true);
    expect(isTrustedMutationOrigin(request("https://malicioso.test", "app.spc.test"))).toBe(false);
  });

  it("rejeita mutação autenticada sem Origin, mas permite cliente sem cookie", () => {
    expect(isTrustedMutationOrigin(request(undefined, "app.spc.test", "session=abc"))).toBe(false);
    expect(isTrustedMutationOrigin(request(undefined, "app.spc.test"))).toBe(true);
  });
});
