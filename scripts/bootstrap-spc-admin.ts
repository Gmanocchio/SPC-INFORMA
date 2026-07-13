import { randomBytes } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  authChallenges,
  authSessions,
  organizations,
  users,
} from "../drizzle/schema";
import { writeAudit } from "../server/audit";
import {
  isValidCnpj,
  isValidCpf,
  normalizeCnpj,
  normalizeCpf,
} from "../server/br-validation";
import { sendFirstAccessCredentials } from "../server/email";
import { hashPassword, normalizeEmail } from "../server/security";

const SPC_CNPJ = normalizeCnpj("29.341.643/0001-80");
const DEFAULT_LOGIN_URL = "https://notifspcbrasil-7zjvpqte.manus.space/acesso";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

function createTemporaryPassword() {
  return `Spc!${randomBytes(18).toString("base64url")}9aA`;
}

async function main() {
  const databaseUrl = requiredEnvironment("DATABASE_URL");
  const name = requiredEnvironment("BOOTSTRAP_ADMIN_NAME");
  const email = normalizeEmail(requiredEnvironment("BOOTSTRAP_ADMIN_EMAIL"));
  const cpf = normalizeCpf(requiredEnvironment("BOOTSTRAP_ADMIN_CPF"));
  const loginUrl = process.env.BOOTSTRAP_LOGIN_URL?.trim() || DEFAULT_LOGIN_URL;

  if (!isValidCpf(cpf)) throw new Error("CPF do administrador é inválido.");
  if (!isValidCnpj(SPC_CNPJ)) throw new Error("CNPJ institucional configurado é inválido.");
  if (!/^https:\/\//.test(loginUrl)) throw new Error("A URL de acesso deve usar HTTPS.");

  const db = drizzle(databaseUrl);
  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  let organizationId = 0;
  let userId = 0;
  let operation: "created" | "updated" = "created";

  await db.transaction(async tx => {
    const [existingOrganization] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.cnpj, SPC_CNPJ))
      .limit(1);

    if (existingOrganization) {
      organizationId = existingOrganization.id;
      await tx
        .update(organizations)
        .set({
          type: "SPC_BRASIL",
          legalName: "SPC BRASIL S.A.",
          tradeName: "SPC Brasil",
          responsibleName: name,
          responsibleEmail: email,
          street: "Alameda Tocantins",
          streetNumber: "125",
          addressExtra: "Andar 15, conjunto 1502",
          district: "Alphaville Centro Industrial e Empresarial/Alphaville",
          city: "Barueri",
          state: "SP",
          status: "ACTIVE",
          deletedAt: null,
        })
        .where(eq(organizations.id, organizationId));
    } else {
      const result = await tx.insert(organizations).values({
        type: "SPC_BRASIL",
        legalName: "SPC BRASIL S.A.",
        tradeName: "SPC Brasil",
        cnpj: SPC_CNPJ,
        responsibleName: name,
        responsibleEmail: email,
        street: "Alameda Tocantins",
        streetNumber: "125",
        addressExtra: "Andar 15, conjunto 1502",
        district: "Alphaville Centro Industrial e Empresarial/Alphaville",
        city: "Barueri",
        state: "SP",
        billingModel: "PREPAID",
        status: "ACTIVE",
      });
      organizationId = Number(result[0].insertId);
    }

    const matchingUsers = await tx
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.cpf, cpf)))
      .limit(2);

    if (matchingUsers.length > 1) {
      throw new Error("Conflito cadastral: e-mail e CPF pertencem a usuários diferentes.");
    }

    const existingUser = matchingUsers[0];
    if (existingUser && (existingUser.email !== email || existingUser.cpf !== cpf)) {
      throw new Error("Conflito cadastral: e-mail ou CPF já está vinculado a outra conta.");
    }

    if (existingUser) {
      operation = "updated";
      userId = existingUser.id;
      await tx
        .update(users)
        .set({
          organizationId,
          name,
          passwordHash,
          loginMethod: "password",
          role: "SPC_ADMIN",
          status: "ACTIVE",
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: null,
          deletedAt: null,
        })
        .where(eq(users.id, userId));
      await tx
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.userId, userId));
      await tx
        .update(authChallenges)
        .set({ usedAt: new Date() })
        .where(eq(authChallenges.userId, userId));
    } else {
      const result = await tx.insert(users).values({
        organizationId,
        name,
        cpf,
        email,
        passwordHash,
        loginMethod: "password",
        role: "SPC_ADMIN",
        status: "ACTIVE",
        mustChangePassword: true,
      });
      userId = Number(result[0].insertId);
    }
  });

  await writeAudit({
    organizationId,
    actorUserId: null,
    action: operation === "created" ? "BOOTSTRAP_SPC_ADMIN_CREATED" : "BOOTSTRAP_SPC_ADMIN_UPDATED",
    resourceType: "user",
    resourceId: userId,
    metadata: { role: "SPC_ADMIN", firstAccessRequired: true },
  });

  try {
    const delivery = await sendFirstAccessCredentials(email, name, temporaryPassword, loginUrl);
    await writeAudit({
      organizationId,
      actorUserId: null,
      action: "FIRST_ACCESS_EMAIL_SENT",
      resourceType: "user",
      resourceId: userId,
      metadata: { providerAccepted: true },
    });
    process.stdout.write(JSON.stringify({
      success: true,
      operation,
      organizationId,
      userId,
      providerMessageId: delivery.messageId ?? null,
    }) + "\n");
  } catch (error) {
    await writeAudit({
      organizationId,
      actorUserId: null,
      action: "FIRST_ACCESS_EMAIL_FAILED",
      resourceType: "user",
      resourceId: userId,
      outcome: "FAILURE",
    });
    throw error;
  }
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.message : "Falha inesperada no bootstrap.");
    process.exit(1);
  },
);

