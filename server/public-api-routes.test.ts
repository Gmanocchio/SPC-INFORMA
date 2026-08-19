import express from "express";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  createEmailCampaignFromApi: vi.fn(),
}));

vi.mock("./api-key-service", () => ({ authenticateApiKey: mocks.authenticateApiKey }));
vi.mock("./campaign-service", () => ({ createEmailCampaignFromApi: mocks.createEmailCampaignFromApi }));

import { registerPublicApiRoutes } from "./public-api-routes";

const validBody = {
  creditorOrganizationId: 34,
  templateId: 12,
  name: "Campanha de homologação",
  idempotencyKey: "9cf9c7d2-0d29-4baf-b585-2c3bd2eb7ae7",
  recipients: [{
    cpf: "52998224725",
    customerName: "Ana Maria",
    customerEmail: "cliente@example.com.br",
    creditorName: "Credor Brasil",
    amount: "R$ 1.234,56",
    dueDate: "31/12/2026",
    contractNumber: "CTR-2026-001",
    creditorPhone: "1140001234",
    creditorEmail: "cobranca@credor.com.br",
    link: "https://credor.example/negociar/CTR-2026-001",
  }],
};

describe("API pública de campanhas de E-mail", () => {
  let server: Server | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.authenticateApiKey.mockResolvedValue({ id: 5, organizationId: 12, createdByUserId: 9, scopes: ["campaigns:write"] });
    mocks.createEmailCampaignFromApi.mockResolvedValue({ id: "campaign-id", status: "READY", recipientCount: 1, requiresConfirmation: true });
    const app = express();
    app.use(express.json());
    registerPublicApiRoutes(app);
    server = await new Promise<Server>(resolve => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Porta de teste indisponível.");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    server = null;
  });

  it("aceita x-api-key, preserva o escopo da organização e cria campanha READY sem enviar", async () => {
    const response = await fetch(`${baseUrl}/api/v1/campaigns/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "ntf_prefix_valid-secret-value" },
      body: JSON.stringify(validBody),
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ status: "READY", requiresConfirmation: true });
    expect(mocks.authenticateApiKey).toHaveBeenCalledWith("ntf_prefix_valid-secret-value", "campaigns:write");
    expect(mocks.createEmailCampaignFromApi).toHaveBeenCalledWith(
      { id: 9, organizationId: 12, role: "ORG_ADMIN" },
      expect.objectContaining({ recipients: [expect.objectContaining({ customerEmail: "cliente@example.com.br" })] }),
    );
  });

  it("aceita Authorization Bearer sem expor a chave na resposta", async () => {
    const response = await fetch(`${baseUrl}/api/v1/campaigns/email`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ntf_prefix_another-secret" },
      body: JSON.stringify(validBody),
    });
    expect(response.status).toBe(201);
    expect(mocks.authenticateApiKey).toHaveBeenCalledWith("ntf_prefix_another-secret", "campaigns:write");
    expect(await response.text()).not.toContain("ntf_prefix_another-secret");
  });

  it("rejeita e-mail do cliente inválido antes de criar a campanha", async () => {
    const response = await fetch(`${baseUrl}/api/v1/campaigns/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "ntf_prefix_valid-secret-value" },
      body: JSON.stringify({ ...validBody, recipients: [{ ...validBody.recipients[0], customerEmail: "52998224725" }] }),
    });
    expect(response.status).toBe(422);
    expect(mocks.createEmailCampaignFromApi).not.toHaveBeenCalled();
  });

  it("propaga falhas de autenticação sem executar o contrato de campanha", async () => {
    mocks.authenticateApiKey.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED", message: "Chave inválida." }));
    const response = await fetch(`${baseUrl}/api/v1/campaigns/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(response.status).toBe(401);
    expect(mocks.createEmailCampaignFromApi).not.toHaveBeenCalled();
  });
});
