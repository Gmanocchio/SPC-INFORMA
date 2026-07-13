export const TEMPLATE_VARIABLES = [
  {
    key: "nome",
    label: "Nome",
    description: "Nome do destinatário informado na planilha.",
    preview: "Cliente Exemplo",
  },
  {
    key: "documento",
    label: "Documento",
    description: "CPF, CNPJ ou identificador informado na planilha.",
    preview: "000.000.000-00",
  },
  {
    key: "valor",
    label: "Valor",
    description: "Valor da cobrança ou negociação.",
    preview: "R$ 000,00",
  },
  {
    key: "data_vencimento",
    label: "Data de vencimento",
    description: "Data de vencimento informada na planilha.",
    preview: "31/12/2099",
  },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

export const TEMPLATE_VARIABLE_KEYS = TEMPLATE_VARIABLES.map(item => item.key);

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
