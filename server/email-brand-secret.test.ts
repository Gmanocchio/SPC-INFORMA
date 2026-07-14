import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { sendLoginCode } from "./email";

describe("configuração pública do remetente", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia SPC Informa como nome do remetente ao endpoint transacional", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 202,
        headers: { "x-message-id": "brand-check" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(ENV.sendGridFromName).toBe("SPC Informa");
    await sendLoginCode("validacao@spcinforma.test", "123456");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.from.name).toBe("SPC Informa");
    expect(payload.subject).toContain("SPC Informa");
  });
});
