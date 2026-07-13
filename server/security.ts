import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 2;
const KEY_LENGTH = 64;

function deriveScrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function assertStrongPassword(password: string): void {
  const valid =
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    !/\s/.test(password);

  if (!valid) {
    throw new Error(
      "A senha deve ter entre 12 e 128 caracteres, com maiúscula, minúscula, número e símbolo, sem espaços.",
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertStrongPassword(password);
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 96 * 1024 * 1024,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, n, r, p, saltEncoded, hashEncoded] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !n ||
    !r ||
    !p ||
    !saltEncoded ||
    !hashEncoded
  ) {
    return false;
  }

  const expected = Buffer.from(hashEncoded, "base64url");
  const actual = await deriveScrypt(
    password,
    Buffer.from(saltEncoded, "base64url"),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 96 * 1024 * 1024,
    },
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function createNumericCode(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacToken(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeTokenEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256")
    .update(`notificadora-spc-field-encryption:v1:${secret}`)
    .digest();
}

export function encryptSensitive(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSensitive(ciphertext: string, secret: string): string {
  const [version, ivEncoded, tagEncoded, valueEncoded] = ciphertext.split(".");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !valueEncoded) {
    throw new Error("Formato de dado criptografado inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(valueEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashNetworkValue(value: string | undefined, secret: string) {
  return value ? hmacToken(value, secret) : null;
}
