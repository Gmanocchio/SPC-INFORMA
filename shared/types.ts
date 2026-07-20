import { users } from "../drizzle/schema";

/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type UserRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER" | "CREDITOR" | "DISTRIBUTOR" | "CDL";
