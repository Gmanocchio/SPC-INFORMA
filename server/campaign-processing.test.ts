import { describe, expect, it } from "vitest";
import { campaignRecipients, campaigns, messageTemplates } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { brokerHeaders, brokerTimeoutMs, dispatchUrl, renderTemplate, templateForCampaign, variablesFor } from "./campaign-processing-service";
import { assertSafeBrokerEndpoint } from "./broker-service";
import { encryptSensitive } from "./security";

describe("processamento de campanhas", () => {
  it("interpola somente variáveis declaradas e esvazia as ausentes", () => {
    expect(renderTemplate("Olá, {{ nome }}. Contrato: {{contrato}} / {{ausente}}", { nome: "Ana", contrato: "42" })).toBe("Olá, Ana. Contrato: 42 / ");
  });

  it.each(["EMAIL", "SMS", "WHATSAPP", "RCS"] as const)("renderiza as nove variáveis homologadas no disparo de %s", channel => {
    const variables = {
      cpf: "52998224725",
      nome_cliente: "Ana Maria",
      nome_credor: "Credor Brasil",
      valor: "R$ 1.234,56",
      data_vencimento: "31/12/2026",
      numero_contrato: "CTR-2026-001",
      telefone_credor: "1140001234",
      email_credor: "cobranca@credor.com.br",
      link: "https://credor.example/negociar/CTR-2026-001",
    };
    expect(renderTemplate(
      `[${channel}] {{nome_cliente}} | {{cpf}} | {{nome_credor}} | {{valor}} | {{data_vencimento}} | {{numero_contrato}} | {{telefone_credor}} | {{email_credor}} | {{link}}`,
      variables,
    )).toBe(`[${channel}] Ana Maria | 52998224725 | Credor Brasil | R$ 1.234,56 | 31/12/2026 | CTR-2026-001 | 1140001234 | cobranca@credor.com.br | https://credor.example/negociar/CTR-2026-001`);
  });

  it("usa o snapshot da campanha mesmo após o template ativo receber uma nova versão", () => {
    const campaign = {
      templateNameSnapshot: "Cobrança homologada",
      templateSubjectSnapshot: "Assunto homologado v7",
      templateContentSnapshot: "Conteúdo homologado v7",
      templateVersionSnapshot: 7,
    } as unknown as typeof campaigns.$inferSelect;
    const currentTemplate = {
      subject: "Assunto revisado v8",
      content: "Conteúdo revisado v8",
      version: 8,
    } as unknown as typeof messageTemplates.$inferSelect;

    expect(templateForCampaign(campaign, currentTemplate)).toEqual({
      name: "Cobrança homologada",
      subject: "Assunto homologado v7",
      content: "Conteúdo homologado v7",
      version: 7,
    });
  });

  it("reconstrói as variáveis pelas colunas persistentes e não pelo JSON legado", () => {
    const encrypt = (value: string) => encryptSensitive(value, ENV.cookieSecret);
    const recipient = {
      cpfCiphertext: encrypt("52998224725"),
      customerNameCiphertext: encrypt("Ana Maria"),
      customerEmailCiphertext: encrypt("cliente@example.com.br"),
      creditorNameCiphertext: encrypt("Credor Brasil"),
      amountCents: 123456,
      dueDate: "2026-12-31",
      contractNumberCiphertext: encrypt("CTR-2026-001"),
      creditorPhoneCiphertext: encrypt("1140001234"),
      creditorEmailCiphertext: encrypt("cobranca@credor.com.br"),
      linkCiphertext: encrypt("https://credor.example/negociar/CTR-2026-001"),
      variablesCiphertext: encrypt(JSON.stringify({ primeiro_nome: "Valor legado" })),
    } as unknown as typeof campaignRecipients.$inferSelect;

    expect(variablesFor(recipient)).toEqual({
      cpf: "52998224725",
      nome_cliente: "Ana Maria",
      email_cliente: "cliente@example.com.br",
      nome_credor: "Credor Brasil",
      valor: "R$ 1.234,56",
      data_vencimento: "31/12/2026",
      numero_contrato: "CTR-2026-001",
      telefone_credor: "1140001234",
      email_credor: "cobranca@credor.com.br",
      link: "https://credor.example/negociar/CTR-2026-001",
      primeiro_nome: "Ana",
      valor_divida: "R$ 1.234,56",
      vencimento_divida: "31/12/2026",
    });
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
