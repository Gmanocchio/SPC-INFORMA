function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function normalizeCpf(value: string) {
  return onlyDigits(value);
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(cpf[9]) && calculate(10) === Number(cpf[10]);
}

export function normalizeCnpj(value: string) {
  return onlyDigits(value);
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false;
  const digit = (baseLength: 12 | 13) => {
    const weights = baseLength === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = onlyDigits(value);
  return digits.length ? digits : null;
}

