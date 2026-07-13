import { TRPCError } from "@trpc/server";

export type ApplicationRole = "SPC_ADMIN" | "ORG_ADMIN" | "REQUESTER";

export type AuthorizationActor = {
  id: number;
  organizationId: number;
  role: ApplicationRole;
};

export type OrganizationReference = {
  id: number;
  parentOrganizationId: number | null;
};

export function canManageOrganization(actor: AuthorizationActor, target: OrganizationReference) {
  return actor.role === "SPC_ADMIN"
    || target.id === actor.organizationId
    || target.parentOrganizationId === actor.organizationId;
}

export function canAccessOrganization(actor: AuthorizationActor, organizationId: number) {
  return actor.role === "SPC_ADMIN" || actor.organizationId === organizationId;
}

export function assertCanAccessOrganization(actor: AuthorizationActor, organizationId: number) {
  if (!canAccessOrganization(actor, organizationId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recurso não encontrado no seu escopo." });
  }
}

export function assertRole(actor: AuthorizationActor, allowed: ApplicationRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para esta operação." });
  }
}
