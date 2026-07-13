import { describe, expect, it } from "vitest";

describe("configuração segura do SendGrid", () => {
  it("autentica a chave e possui permissão de envio de e-mail", async () => {
    const apiKey = process.env.SENDGRID_API_KEY;

    expect(apiKey, "SENDGRID_API_KEY deve estar configurada").toBeTruthy();

    const response = await fetch("https://api.sendgrid.com/v3/scopes", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    expect(response.status, "A chave do SendGrid deve ser válida").toBe(200);

    const payload = (await response.json()) as { scopes?: string[] };
    expect(payload.scopes).toContain("mail.send");
  }, 12_000);
});
