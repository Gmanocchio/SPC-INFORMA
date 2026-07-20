const TEMPLATE_PUBLIC_ID_PREFIX = "TP";
const TEMPLATE_PUBLIC_ID_MIN_DIGITS = 6;

export function formatTemplatePublicId(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RangeError("O ID interno do template deve ser um inteiro positivo e seguro.");
  }

  return `${TEMPLATE_PUBLIC_ID_PREFIX}-${String(id).padStart(TEMPLATE_PUBLIC_ID_MIN_DIGITS, "0")}`;
}
