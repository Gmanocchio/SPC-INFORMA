import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    sendGridApiKey: "test-api-key",
    sendGridFromEmail: "contato@example.com",
    sendGridFromName: "SPC Informa",
  },
}));

import { sendFirstAccessCredentials } from "./email";

describe("sendFirstAccessCredentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia credencial temporária com primeiro acesso, MFA e rastreamento desativado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "x-message-id": "msg-first-access" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendFirstAccessCredentials(
      "admin@example.com",
      "Administrador",
      "SenhaTemporaria!123",
      "https://example.com/acesso",
    );

    expect(result).toEqual({ messageId: "msg-first-access" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.personalizations[0].to[0].email).toBe("admin@example.com");
    expect(body.subject).toContain("acesso administrativo");
    expect(body.content[0].value).toContain("SenhaTemporaria!123");
    expect(body.content[0].value).toContain("código de validação");
    expect(body.content[0].value).toContain("https://example.com/acesso");
    expect(body.tracking_settings).toEqual({
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    });
  });
});
