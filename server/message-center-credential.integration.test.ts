import { describe, expect, it } from "vitest";

const enabled = process.env.RUN_MESSAGE_CENTER_CREDENTIAL_TEST === "1";

describe.runIf(enabled)("credencial Message Center", () => {
  it("autentica a API key sem fornecer destinatário nem permitir envio", async () => {
    const apiKey = process.env.MESSAGE_CENTER_API_KEY;
    expect(apiKey, "MESSAGE_CENTER_API_KEY deve estar configurada").toBeTruthy();

    const response = await fetch(
      "https://sistema.messagecenter.com.br/api/Integracao/EnviarEmailComTemplate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: apiKey!,
        },
        body: new FormData(),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body = await response.text();

    expect(response.status, "A credencial não pode ser rejeitada como não autorizada").not.toBe(401);
    expect(body).not.toMatch(/chave de api não encontrada|unauthorized/i);
  }, 20_000);
});
