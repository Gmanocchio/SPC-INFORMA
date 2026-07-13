export const TEMPLATE_VARIABLES = [
  {
    key: "cpf",
    column: "CPF",
    label: "CPF",
    description: "CPF do cliente usado para identificar o destinatário.",
    preview: "000.000.000-00",
  },
  {
    key: "primeiro_nome",
    column: "Nome do cliente (primeiro nome)",
    label: "Primeiro nome do cliente",
    description: "Primeiro nome usado para personalizar a mensagem.",
    preview: "Cliente",
  },
  {
    key: "valor_divida",
    column: "Valor da dívida",
    label: "Valor da dívida",
    description: "Valor da dívida normalizado em reais.",
    preview: "R$ 1.234,56",
  },
  {
    key: "vencimento_divida",
    column: "Vencimento da dívida",
    label: "Vencimento da dívida",
    description: "Data de vencimento da dívida no formato brasileiro.",
    preview: "31/12/2026",
  },
  {
    key: "numero_contrato",
    column: "Número do contrato",
    label: "Número do contrato",
    description: "Identificador do contrato vinculado à dívida.",
    preview: "CTR-2026-0001",
  },
  {
    key: "telefone_credor",
    column: "Telefone do credor",
    label: "Telefone do credor",
    description: "Número de contato disponibilizado pelo credor.",
    preview: "(11) 4000-0000",
  },
  {
    key: "email_credor",
    column: "E-mail do credor",
    label: "E-mail do credor",
    description: "E-mail de contato disponibilizado pelo credor.",
    preview: "contato@credor.com.br",
  },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

export const TEMPLATE_VARIABLE_KEYS = TEMPLATE_VARIABLES.map(item => item.key);
export const CAMPAIGN_IMPORT_COLUMNS = TEMPLATE_VARIABLES.map(item => item.column);

export function formatDebtAmountCents(value: number) {
  const absolute = Math.abs(value);
  const integer = Math.floor(absolute / 100).toLocaleString("pt-BR");
  const cents = String(absolute % 100).padStart(2, "0");
  return `${value < 0 ? "-" : ""}R$ ${integer},${cents}`;
}

export function formatDebtDueDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const allowedTemplateVariables = new Set<string>(TEMPLATE_VARIABLE_KEYS);
const templateVariableExpression = /{{\s*([A-Za-z_][A-Za-z0-9_.-]{0,49})\s*}}/g;

export function templateVariableToken(key: TemplateVariableKey) {
  return `{{${key}}}`;
}

export function isTemplateVariableKey(value: string): value is TemplateVariableKey {
  return allowedTemplateVariables.has(value);
}

export function extractTemplateVariables(subject: string | null | undefined, content: string) {
  const values = new Set<string>();
  for (const source of [subject ?? "", content]) {
    templateVariableExpression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = templateVariableExpression.exec(source)) !== null) {
      if (match[1]) values.add(match[1]);
    }
  }
  return Array.from(values).sort();
}

export function findUnsupportedTemplateVariables(subject: string | null | undefined, content: string) {
  return extractTemplateVariables(subject, content).filter(variable => !isTemplateVariableKey(variable));
}

export function insertTemplateVariableAtSelection(
  value: string,
  key: TemplateVariableKey,
  selectionStart?: number | null,
  selectionEnd?: number | null,
) {
  const start = Math.max(0, Math.min(value.length, selectionStart ?? value.length));
  const end = Math.max(start, Math.min(value.length, selectionEnd ?? start));
  const token = templateVariableToken(key);
  const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
  const caret = start + token.length;
  return { value: nextValue, selectionStart: caret, selectionEnd: caret };
}
