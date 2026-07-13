export const TEMPLATE_VARIABLES = [
  {
    key: "cpf",
    column: "CPF",
    label: "CPF",
    description: "CPF do cliente usado para identificar o destinatário.",
    preview: "000.000.000-00",
  },
  {
    key: "nome_cliente",
    column: "Nome do cliente",
    label: "Nome do cliente",
    description: "Nome completo do cliente usado na comunicação.",
    preview: "Ana Maria da Silva",
  },
  {
    key: "nome_credor",
    column: "Nome do credor",
    label: "Nome do credor",
    description: "Nome do credor responsável pelo contrato.",
    preview: "Credor Exemplo",
  },
  {
    key: "valor",
    column: "Valor",
    label: "Valor",
    description: "Valor da cobrança normalizado em reais.",
    preview: "R$ 1.234,56",
  },
  {
    key: "data_vencimento",
    column: "Data de vencimento",
    label: "Data de vencimento",
    description: "Data de vencimento no formato brasileiro.",
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
    column: "Números de contato do credor (telefone)",
    label: "Números de contato do credor",
    description: "Um ou mais telefones do credor, separados por ponto e vírgula.",
    preview: "(11) 4000-0000",
  },
  {
    key: "email_credor",
    column: "E-mail de contato do credor",
    label: "E-mail de contato do credor",
    description: "E-mail de contato disponibilizado pelo credor.",
    preview: "contato@credor.com.br",
  },
  {
    key: "link",
    column: "Link",
    label: "Link",
    description: "Endereço HTTPS de acesso disponibilizado ao cliente.",
    preview: "https://exemplo.com.br/negociacao",
  },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

export const TEMPLATE_VARIABLE_KEYS = TEMPLATE_VARIABLES.map(item => item.key);
export const CAMPAIGN_IMPORT_COLUMNS = TEMPLATE_VARIABLES.map(item => item.column);

export function campaignImportHeaderRow(columns: readonly string[] = CAMPAIGN_IMPORT_COLUMNS) {
  return [...columns];
}

export function campaignImportCsvHeader(columns: readonly string[] = CAMPAIGN_IMPORT_COLUMNS, separator = ";") {
  return `\uFEFF${campaignImportHeaderRow(columns).join(separator)}\r\n`;
}

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

export const LEGACY_TEMPLATE_VARIABLE_KEYS = ["primeiro_nome", "valor_divida", "vencimento_divida"] as const;
const allowedTemplateVariables = new Set<string>([...TEMPLATE_VARIABLE_KEYS, ...LEGACY_TEMPLATE_VARIABLE_KEYS]);
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
