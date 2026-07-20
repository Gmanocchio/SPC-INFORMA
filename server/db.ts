import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  if (!user.organizationId) {
    console.warn("[Database] User upsert attempted without organizationId", user.openId);
    throw new Error("organizationId is required for user upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      name: user.name ?? "",
      email: user.email ?? "",
      organizationId: user.organizationId ?? 1, // Default to a valid organization ID if possible, or handle appropriately
      cpf: user.cpf ?? "00000000000",
      passwordHash: user.passwordHash ?? "",
      loginMethod: user.loginMethod ?? "password",
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "SPC_ADMIN" : "REQUESTER"),
      status: user.status ?? "ACTIVE",
      mustChangePassword: user.mustChangePassword ?? false,
      failedLoginAttempts: user.failedLoginAttempts ?? 0,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      lastSignedIn: user.lastSignedIn ?? new Date(),
      phone: user.phone ?? null,
      lockedUntil: user.lockedUntil ?? null,
      passwordChangedAt: user.passwordChangedAt ?? null,
      createdByUserId: user.createdByUserId ?? null,
      deletedAt: user.deletedAt ?? null,
    };

    const updateSet: Partial<InsertUser> = {};

    // Populate updateSet with fields from the user object that are explicitly provided
    // and are not 'openId'.
    for (const key in user) {
      if (key !== "openId" && (user as any)[key] !== undefined) {
        (updateSet as any)[key] = (user as any)[key] ?? null;
      }
    }

    // Ensure lastSignedIn is always updated in updateSet
    updateSet.lastSignedIn = user.lastSignedIn ?? new Date();

    // If role was not explicitly provided in the user object, ensure it's set correctly in updateSet
    if (user.role === undefined) {
      updateSet.role = values.role;
    }

    // If no other fields were updated, ensure lastSignedIn is still set
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Ensure organizationId is always present in updateSet
    if (updateSet.organizationId === undefined) {
      updateSet.organizationId = values.organizationId;
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
