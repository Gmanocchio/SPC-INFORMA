import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isFreshWebhookTimestamp, mappedEvent, nextRecipientStatus, sameHex } from "./webhook-routes";

describe("webhook de brokers", () => {
  it("normaliza os eventos de entrega suportados", () => {
    expect(mappedEvent("delivery.success")).toEqual({ eventType: "DELIVERED", status: "DELIVERED" });
    expect(mappedEvent("bounced")).toEqual({ eventType: "FAILED", status: "FAILED" });
    expect(mappedEvent("email.opened")).toEqual({ eventType: "READ", status: null });
    expect(mappedEvent("link-clicked")).toEqual({ eventType: "CLICKED", status: null });
    expect(mappedEvent("reported as spam")).toEqual({ eventType: "SPAM", status: "OPTED_OUT" });
    expect(mappedEvent("opt-out")).toEqual({ eventType: "OPTED_OUT", status: "OPTED_OUT" });
    expect(mappedEvent("evento-desconhecido")).toBeNull();
  });

  it("compara assinatura SHA-256 sem vazar diferenças de conteúdo", () => {
    const body = Buffer.from('{"eventId":"evt-1"}');
    const signature = createHmac("sha256", "segredo-forte").update(body).digest("hex");
    expect(sameHex(`sha256=${signature}`, signature)).toBe(true);
    expect(sameHex("sha256=00", signature)).toBe(false);
    expect(sameHex("valor-invalido", signature)).toBe(false);
  });

  it("exige timestamp recente para impedir replay criptográfico", () => {
    const now = 1_750_000_000_000;
    expect(isFreshWebhookTimestamp(undefined, now)).toBe(false);
    expect(isFreshWebhookTimestamp(String(now), now)).toBe(true);
    expect(isFreshWebhookTimestamp(String(now - 300_001), now)).toBe(false);
  });

  it("atualiza entrega sem regredir estados terminais", () => {
    expect(nextRecipientStatus("SENT", "DELIVERED")).toBe("DELIVERED");
    expect(nextRecipientStatus("FAILED", "DELIVERED")).toBe("DELIVERED");
    expect(nextRecipientStatus("DELIVERED", "FAILED")).toBe("DELIVERED");
    expect(nextRecipientStatus("FAILED", "SENT")).toBe("FAILED");
  });
});
