type MessageCenterVariables = Record<string, string>;

export type MessageCenterEmailInput = {
  recipientId: number;
  destination: string;
  templateName: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  campaignId: string;
  organizationId: number;
  creditorOrganizationId: number;
  variables: MessageCenterVariables;
};

export type MessageCenterConfig = Record<string, string | number | boolean | null>;

const MESSAGE_CENTER_HOST = "sistema.messagecenter.com.br";
const MESSAGE_CENTER_SEND_PATH = "/api/Integracao/EnviarEmailComTemplate";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw Object.assign(new Error(`${label} da Message Center não configurado.`), { retryable: false });
  return normalized;
}

export function isMessageCenterEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.hostname.toLowerCase() === MESSAGE_CENTER_HOST && url.pathname === MESSAGE_CENTER_SEND_PATH;
  } catch {
    return false;
  }
}

export function messageCenterRequestBudget(extra: MessageCenterConfig) {
  return Math.min(3_000, Math.max(1, Number(extra.maxRequestsPerRun) || 45));
}

export function messageCenterConcurrency(extra: MessageCenterConfig) {
  return Math.min(20, Math.max(1, Number(extra.concurrency) || 5));
}

export function buildMessageCenterRequest(endpoint: string, apiKey: string, input: MessageCenterEmailInput) {
  if (!isMessageCenterEndpoint(endpoint)) {
    throw Object.assign(new Error("Endpoint Message Center inválido ou não autorizado."), { retryable: false });
  }
  const destination = required(input.destination.toLowerCase(), "Destinatário");
  const senderEmail = required(input.senderEmail.toLowerCase(), "E-mail do remetente");
  if (!EMAIL_PATTERN.test(destination)) throw Object.assign(new Error("E-mail do cliente inválido para a Message Center."), { retryable: false });
  if (!EMAIL_PATTERN.test(senderEmail)) throw Object.assign(new Error("E-mail do remetente inválido para a Message Center."), { retryable: false });
  const url = new URL(endpoint);
  url.search = "";
  const parameters: Record<string, string> = {
    Destinatario: destination,
    NomeTemplate: required(input.templateName, "Nome do template"),
    RemetenteNome: required(input.senderName, "Nome do remetente"),
    RemetenteEmail: senderEmail,
    Assunto: required(input.subject, "Assunto"),
    Identificador: String(input.recipientId),
    ClienteNome: input.variables.nome_cliente ?? "",
    ClienteDocumento: input.variables.cpf ?? "",
    NossoNumero: input.variables.numero_contrato ?? "",
    I_instrucao_1: input.variables.valor ?? "",
    I_instrucao_2: input.variables.data_vencimento ?? "",
    I_instrucao_3: input.variables.nome_credor ?? "",
    I_instrucao_4: input.variables.telefone_credor ?? "",
    I_instrucao_5: input.variables.email_credor ?? "",
    CamposCustomizados1: input.campaignId,
    CamposCustomizados2: String(input.organizationId),
    CamposCustomizados3: String(input.creditorOrganizationId),
    CamposCustomizados4: input.variables.numero_contrato ?? "",
    CamposCustomizados5: input.variables.link ?? "",
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value.slice(0, 2_048));
  return {
    url: url.toString(),
    init: {
      method: "POST",
      headers: { accept: "application/json", apikey: required(apiKey, "API key") },
      body: new FormData(),
    } satisfies RequestInit,
  };
}

export async function sendMessageCenterEmail(
  endpoint: string,
  apiKey: string,
  input: MessageCenterEmailInput,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
) {
  const request = buildMessageCenterRequest(endpoint, apiKey, input);
  let response: Response;
  try {
    response = await fetchImpl(request.url, { ...request.init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : "Falha de rede ao acionar a Message Center."), { retryable: true });
  }
  const text = await response.text();
  if (!response.ok) {
    throw Object.assign(new Error(`Message Center respondeu HTTP ${response.status}.`), {
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      status: response.status,
    });
  }
  return { brokerMessageId: `mc:${input.recipientId}`, responseStatus: response.status, responseAccepted: text.trim() || "OK" };
}
