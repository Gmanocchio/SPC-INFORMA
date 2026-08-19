import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { messageCenterCallbackToken } from "./message-center-callback";

const routerSource = readFileSync(new URL("./routers/brokers.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./broker-service.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Brokers.tsx", import.meta.url), "utf8");

describe("configuração operacional da Message Center", () => {
  it("gera token determinístico sem incorporar a API key ao caminho", () => {
    const token = messageCenterCallbackToken(1, "api-key-protegida", "segredo-da-aplicacao");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token).not.toContain("api-key-protegida");
  });

  it("expõe a URL somente por procedimento SPC_ADMIN e registra auditoria", () => {
    expect(routerSource).toMatch(/messageCenterCallback:\s*spcAdminProcedure/);
    expect(serviceSource).toContain("BROKER_CALLBACK_URL_VIEWED");
    expect(serviceSource).toContain("rotatesWithApiKey: true");
    expect(serviceSource).not.toMatch(/return\s+\{[^}]*apiKey/s);
  });

  it("oferece configuração específica e cópia do callback apenas no broker Message Center", () => {
    expect(pageSource).toContain("Copiar callback");
    expect(pageSource).toContain("Nome do template no provedor");
    expect(pageSource).toContain("Requisições por execução");
    expect(pageSource).toContain("sistema.messagecenter.com.br/api/Integracao/EnviarEmailComTemplate");
  });
});
