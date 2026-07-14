import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { messageTemplates } from "./drizzle/schema";
import { eq } from "drizzle-orm";
import { listAvailableTemplates } from "./template-service";

describe("listAvailableTemplates - Integration Test", () => {
  beforeAll(async () => {
    // This test runs against the real database
  });

  it("retorna templates do SPC Brasil com status ACTIVE", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verificar quantos templates ACTIVE existem para SPC Brasil
    const allActiveTemplates = await db
      .select({
        id: messageTemplates.id,
        name: messageTemplates.name,
        channel: messageTemplates.channel,
        organizationId: messageTemplates.organizationId,
        status: messageTemplates.status,
      })
      .from(messageTemplates)
      .where(eq(messageTemplates.status, "ACTIVE"));

    console.log(`Total de templates ACTIVE no banco: ${allActiveTemplates.length}`);
    console.log(`Templates ACTIVE:`, allActiveTemplates);

    // Verificar quantos são do SPC Brasil
    const spcBrasilTemplates = allActiveTemplates.filter(t => t.organizationId === 1);
    console.log(`Templates ACTIVE do SPC Brasil: ${spcBrasilTemplates.length}`);

    // Chamar a função
    const result = await listAvailableTemplates({ id: 1, organizationId: 2, role: "ORG_ADMIN" });
    console.log(`Resultado de listAvailableTemplates: ${result.length} templates`);
    console.log(`Resultado:`, result);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every(t => t.channel === "SMS" || t.channel === "EMAIL" || t.channel === "WHATSAPP" || t.channel === "RCS")).toBe(true);
  });

  it("filtra por canal SMS", async () => {
    const result = await listAvailableTemplates({ id: 1, organizationId: 2, role: "ORG_ADMIN" }, "SMS");
    console.log(`Resultado para SMS: ${result.length} templates`);
    console.log(`Resultado:`, result);

    expect(result.every(t => t.channel === "SMS")).toBe(true);
  });

  it("filtra por canal EMAIL", async () => {
    const result = await listAvailableTemplates({ id: 1, organizationId: 2, role: "ORG_ADMIN" }, "EMAIL");
    console.log(`Resultado para EMAIL: ${result.length} templates`);
    console.log(`Resultado:`, result);

    expect(result.every(t => t.channel === "EMAIL")).toBe(true);
  });

  it("filtra por canal WHATSAPP", async () => {
    const result = await listAvailableTemplates({ id: 1, organizationId: 2, role: "ORG_ADMIN" }, "WHATSAPP");
    console.log(`Resultado para WHATSAPP: ${result.length} templates`);
    console.log(`Resultado:`, result);

    expect(result.every(t => t.channel === "WHATSAPP")).toBe(true);
  });
});
