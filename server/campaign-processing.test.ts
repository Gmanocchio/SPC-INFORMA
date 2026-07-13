import { describe, expect, it } from "vitest";
import { brokerHeaders, brokerTimeoutMs, dispatchUrl, renderTemplate } from "./campaign-processing-service";
import { assertSafeBrokerEndpoint } from "./broker-service";

describe("processamento de campanhas", () => {
  it("interpola somente variáveis declaradas e esvazia as ausentes", () => {
    expect(renderTemplate("Olá, {{ nome }}. Contrato: {{contrato}} / {{ausente}}", { nome: "Ana", contrato: "42" })).toBe("Olá, Ana. Contrato: 42 / ");
  });

  it("monta autenticação por token e respeita header configurado", () => {
    expect(brokerHeaders({ apiKey: "abc" }, {})).toMatchObject({ authorization: "Bearer abc", "content-type": "application/json" });
    expect(brokerHeaders({ apiKey: "abc" }, { apiKeyHeader: "x-api-key", apiKeyPrefix: false })).toMatchObject({ "x-api-key": "abc" });
    expect(brokerHeaders({ username: "user", password: "pass" }, {}).authorization).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
  });

  it("resolve a rota de envio relativamente à base do provedor", () => {
    expect(dispatchUrl("https://broker.example/api/", { sendPath: "v1/messages" })).toBe("https://broker.example/api/v1/messages");
    expect(dispatchUrl("https://broker.example/send", {})).toBe("https://broker.example/send");
  });

  it("rejeita endpoints internos ou com credenciais embutidas", () => {
    expect(() => assertSafeBrokerEndpoint("http://broker.example/send")).toThrow();
    expect(() => assertSafeBrokerEndpoint("https://127.0.0.1/send")).toThrow();
    expect(() => assertSafeBrokerEndpoint("https://user:pass@broker.example/send")).toThrow();
    expect(() => assertSafeBrokerEndpoint("https://broker.example/send")).not.toThrow();
  });

  it("aplica timeout configurável dentro dos limites operacionais", () => {
    expect(brokerTimeoutMs({})).toBe(10_000);
    expect(brokerTimeoutMs({ timeoutMs: 5_000 })).toBe(5_000);
    expect(brokerTimeoutMs({ timeoutMs: 100 })).toBe(1_000);
    expect(brokerTimeoutMs({ timeoutMs: 60_000 })).toBe(30_000);
  });
});
