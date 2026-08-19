import { describe, expect, it, vi } from "vitest";
import {
  buildMessageCenterRequest,
  isMessageCenterEndpoint,
  messageCenterConcurrency,
  messageCenterRequestBudget,
  sendMessageCenterEmail,
} from "./message-center-adapter";

const endpoint = "https://sistema.messagecenter.com.br/api/Integracao/EnviarEmailComTemplate";
const input = {
  recipientId: 456,
  destination: "CLIENTE@EXAMPLE.COM.BR",
  templateName: "Cobrança amigável",
  senderName: "Credor Brasil",
  senderEmail: "cobranca@credor.com.br",
  subject: "Condições do contrato",
  campaignId: "9cf9c7d2-0d29-4baf-b585-2c3bd2eb7ae7",
  organizationId: 12,
  creditorOrganizationId: 34,
  variables: {
    cpf: "52998224725",
    nome_cliente: "Ana Maria",
    nome_credor: "Credor Brasil",
    valor: "R$ 1.234,56",
    data_vencimento: "31/12/2026",
    numero_contrato: "CTR-2026-001",
    telefone_credor: "1140001234",
    email_credor: "cobranca@credor.com.br",
    link: "https://credor.example/negociar/CTR-2026-001",
  },
};

describe("adaptador Message Center", () => {
  it("reconhece somente o endpoint HTTPS oficial exato", () => {
    expect(isMessageCenterEndpoint(endpoint)).toBe(true);
    expect(isMessageCenterEndpoint(endpoint.replace("https:", "http:"))).toBe(false);
    expect(isMessageCenterEndpoint("https://evil.example/api/Integracao/EnviarEmailComTemplate")).toBe(false);
    expect(isMessageCenterEndpoint("https://sistema.messagecenter.com.br/outro")).toBe(false);
  });

  it("serializa os parâmetros oficiais e mantém a API key exclusivamente no header", () => {
    const request = buildMessageCenterRequest(endpoint, "secret-api-key", input);
    const url = new URL(request.url);
    expect(url.searchParams.get("Destinatario")).toBe("cliente@example.com.br");
    expect(url.searchParams.get("NomeTemplate")).toBe("Cobrança amigável");
    expect(url.searchParams.get("RemetenteNome")).toBe("Credor Brasil");
    expect(url.searchParams.get("RemetenteEmail")).toBe("cobranca@credor.com.br");
    expect(url.searchParams.get("Assunto")).toBe("Condições do contrato");
    expect(url.searchParams.get("Identificador")).toBe("456");
    expect(url.searchParams.get("ClienteDocumento")).toBe("52998224725");
    expect(url.searchParams.get("NossoNumero")).toBe("CTR-2026-001");
    expect(url.searchParams.get("CamposCustomizados1")).toBe(input.campaignId);
    expect(request.url).not.toContain("secret-api-key");
    expect(request.init.headers).toMatchObject({ apikey: "secret-api-key" });
    expect(request.init.body).toBeInstanceOf(FormData);
  });

  it("usa limites conservadores e respeita os máximos documentados", () => {
    expect(messageCenterRequestBudget({})).toBe(45);
    expect(messageCenterRequestBudget({ maxRequestsPerRun: 9_000 })).toBe(3_000);
    expect(messageCenterConcurrency({})).toBe(5);
    expect(messageCenterConcurrency({ concurrency: 99 })).toBe(20);
  });

  it("aceita HTTP 200 sem depender de um corpo JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("OK", { status: 200 })) as unknown as typeof fetch;
    await expect(sendMessageCenterEmail(endpoint, "secret-api-key", input, 5_000, fetchImpl)).resolves.toEqual({
      brokerMessageId: "mc:456",
      responseStatus: 200,
      responseAccepted: "OK",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("classifica 429 e 5xx como transitórios e 400 como definitivo", async () => {
    const retryableFetch = vi.fn(async () => new Response("limite", { status: 429 })) as unknown as typeof fetch;
    await expect(sendMessageCenterEmail(endpoint, "secret-api-key", input, 5_000, retryableFetch)).rejects.toMatchObject({ retryable: true, status: 429 });
    const permanentFetch = vi.fn(async () => new Response("inválido", { status: 400 })) as unknown as typeof fetch;
    await expect(sendMessageCenterEmail(endpoint, "secret-api-key", input, 5_000, permanentFetch)).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  it("bloqueia destinatário inválido antes da chamada externa", () => {
    expect(() => buildMessageCenterRequest(endpoint, "secret-api-key", { ...input, destination: "52998224725" })).toThrow(/E-mail do cliente inválido/);
  });
});
