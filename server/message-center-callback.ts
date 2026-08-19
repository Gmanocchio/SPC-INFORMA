import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const messageCenterCallbackEvent = z.object({
  IdCall: z.union([z.string(), z.number()]).transform(String),
  Identificador: z.union([z.string(), z.number()]).transform(String),
  ClienteNome: z.string().optional().default(""),
  DocumentoCliente: z.string().optional().default(""),
  Destinatario: z.string().optional().default(""),
  DataEvento: z.string().optional().default(""),
  Status: z.string().optional().default(""),
  StatusEntregue: z.string().optional().default(""),
  MensagemStatus: z.string().optional().default(""),
  CentroCusto: z.string().optional().default(""),
  CampanhaId: z.union([z.string(), z.number()]).transform(String).optional(),
  MetodoEnvio: z.string().optional().default(""),
  FormatoEnvio: z.string().optional().default(""),
  CampoCustomizado1: z.string().optional().default(""),
  CampoCustomizado2: z.string().optional().default(""),
  CampoCustomizado3: z.string().optional().default(""),
  CampoCustomizado4: z.string().optional().default(""),
  CampoCustomizado5: z.string().optional().default(""),
}).passthrough();

export type MessageCenterCallbackEvent = z.infer<typeof messageCenterCallbackEvent>;

export function messageCenterBatchItems(body: unknown) {
  const items = Array.isArray(body) ? body : [body];
  if (items.length < 1 || items.length > 10) throw new Error("O callback Message Center aceita entre 1 e 10 eventos por lote.");
  return items;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function mapMessageCenterEvent(event: MessageCenterCallbackEvent) {
  const message = normalized(event.MensagemStatus);
  const status = normalized(event.Status);
  const delivery = normalized(event.StatusEntregue);
  if (/spam|complaint|denuncia/.test(message)) return { eventType: "SPAM" as const, status: "OPTED_OUT" as const };
  if (/opt.?out|descadastr|cancelou|bloquead/.test(message)) return { eventType: "OPTED_OUT" as const, status: "OPTED_OUT" as const };
  if (/clique|clicou|link click/.test(message)) return { eventType: "CLICKED" as const, status: null };
  if (/abert|leitura|visualiz|lido/.test(message)) return { eventType: "READ" as const, status: null };
  if (delivery === "entregue") return { eventType: "DELIVERED" as const, status: "DELIVERED" as const };
  if (delivery === "nao entregue" || status === "nao enviado") return { eventType: "FAILED" as const, status: "FAILED" as const };
  if (status === "enviado") return { eventType: "SENT" as const, status: "SENT" as const };
  return null;
}

export function messageCenterOccurredAt(value: string, fallback = new Date()) {
  const clean = value.trim();
  if (!clean) return fallback;
  const withoutZone = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(clean)
    ? `${clean.replace(" ", "T")}-03:00`
    : clean;
  const parsed = new Date(withoutZone);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function messageCenterCallbackToken(brokerId: number, apiKey: string, applicationSecret: string) {
  return createHmac("sha256", applicationSecret)
    .update(`message-center:${brokerId}:${createHmac("sha256", applicationSecret).update(apiKey).digest("hex")}`)
    .digest("hex");
}

export function validMessageCenterCallbackToken(actual: string, expected: string) {
  const a = Buffer.from(actual.trim().toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && a.length === 32 && timingSafeEqual(a, b);
}

export function messageCenterExternalEventId(brokerId: number, event: MessageCenterCallbackEvent, eventType: string) {
  return `mc:${brokerId}:${event.IdCall}:${eventType}:${event.DataEvento || "sem-data"}`.slice(0, 240);
}
