import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { auditLogs, organizations, users } from "../drizzle/schema";
import { normalizeEmail } from "../server/security";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.VERIFY_ADMIN_EMAIL;
  if (!databaseUrl || !email) throw new Error("Configuração de verificação ausente.");

  const db = drizzle(databaseUrl);
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      organizationId: organizations.id,
      organizationType: organizations.type,
      organizationName: organizations.legalName,
      organizationStatus: organizations.status,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  if (!account) throw new Error("Conta administrativa não encontrada.");

  const events = await db
    .select({
      action: auditLogs.action,
      outcome: auditLogs.outcome,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.resourceId, String(account.id)))
    .orderBy(desc(auditLogs.id))
    .limit(5);

  process.stdout.write(JSON.stringify({ account, events }) + "\n");
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error instanceof Error ? error.message : "Falha inesperada na verificação.");
    process.exit(1);
  },
);
