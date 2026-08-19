import { describe, expect, it } from "vitest";
import {
  mapMessageCenterEvent,
  messageCenterBatchItems,
  messageCenterCallbackEvent,
  messageCenterCallbackToken,
  messageCenterExternalEventId,
  messageCenterOccurredAt,
  validMessageCenterCallbackToken,
} from "./message-center-callback";

const baseEvent = messageCenterCallbackEvent.parse({
  IdCall: "50199107841985",
  Identificador: "456",
  ClienteNome: "Ana Maria",
  DocumentoCliente: "52998224725",
  Destinatario: "cliente@example.com.br",
  DataEvento: "2026-08-18 10:30:00",
  Status: "Enviado",
  StatusEntregue: "Entregue",
  MensagemStatus: "Mensagem entregue com sucesso",
  MetodoEnvio: "Email",
  FormatoEnvio: "Campanhas",
  CampoCustomizado1: "9cf9c7d2-0d29-4baf-b585-2c3bd2eb7ae7",
});

describe("callback Message Center", () => {
  it("aceita evento único ou lote de até dez e rejeita volumes maiores", () => {
    expect(messageCenterBatchItems(baseEvent)).toHaveLength(1);
    expect(messageCenterBatchItems(Array.from({ length: 10 }, () => baseEvent))).toHaveLength(10);
    expect(() => messageCenterBatchItems([])).toThrow(/entre 1 e 10/);
    expect(() => messageCenterBatchItems(Array.from({ length: 11 }, () => baseEvent))).toThrow(/entre 1 e 10/);
  });

  it("normaliza entrega, falha, abertura, clique, spam e opt-out", () => {
    expect(mapMessageCenterEvent(baseEvent)).toEqual({ eventType: "DELIVERED", status: "DELIVERED" });
    expect(mapMessageCenterEvent({ ...baseEvent, Status: "Não enviado", StatusEntregue: "Não entregue", MensagemStatus: "Falha" })).toEqual({ eventType: "FAILED", status: "FAILED" });
    expect(mapMessageCenterEvent({ ...baseEvent, StatusEntregue: "", MensagemStatus: "Abertura de e-mail" })).toEqual({ eventType: "READ", status: null });
    expect(mapMessageCenterEvent({ ...baseEvent, StatusEntregue: "", MensagemStatus: "Clique no link" })).toEqual({ eventType: "CLICKED", status: null });
    expect(mapMessageCenterEvent({ ...baseEvent, MensagemStatus: "Denúncia de spam" })).toEqual({ eventType: "SPAM", status: "OPTED_OUT" });
    expect(mapMessageCenterEvent({ ...baseEvent, MensagemStatus: "Cliente descadastrado" })).toEqual({ eventType: "OPTED_OUT", status: "OPTED_OUT" });
  });

  it("interpreta DataEvento no fuso brasileiro e usa fallback para datas inválidas", () => {
    expect(messageCenterOccurredAt("2026-08-18 10:30:00").toISOString()).toBe("2026-08-18T13:30:00.000Z");
    const fallback = new Date("2026-08-18T14:00:00.000Z");
    expect(messageCenterOccurredAt("inválida", fallback)).toBe(fallback);
  });

  it("deriva token opaco e valida em tempo constante sem aceitar formato parcial", () => {
    const token = messageCenterCallbackToken(4, "api-key-provider", "application-secret");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(validMessageCenterCallbackToken(token, token)).toBe(true);
    expect(validMessageCenterCallbackToken(token.slice(2), token)).toBe(false);
    expect(messageCenterCallbackToken(5, "api-key-provider", "application-secret")).not.toBe(token);
    expect(messageCenterCallbackToken(4, "rotated-api-key", "application-secret")).not.toBe(token);
  });

  it("gera chave de idempotência determinística por chamada, evento e data", () => {
    const delivered = messageCenterExternalEventId(4, baseEvent, "DELIVERED");
    expect(messageCenterExternalEventId(4, baseEvent, "DELIVERED")).toBe(delivered);
    expect(messageCenterExternalEventId(4, baseEvent, "READ")).not.toBe(delivered);
    expect(messageCenterExternalEventId(4, { ...baseEvent, DataEvento: "2026-08-18 10:31:00" }, "DELIVERED")).not.toBe(delivered);
  });
});
