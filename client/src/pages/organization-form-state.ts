export const SPC_BRASIL_LINK_VALUE = "__SPC_BRASIL__";

export function toLinkedOrganizationSelectValue(linkedToOrganizationId: string) {
  return linkedToOrganizationId || SPC_BRASIL_LINK_VALUE;
}

export function fromLinkedOrganizationSelectValue(value: string) {
  return value === SPC_BRASIL_LINK_VALUE ? "" : value;
}

export function toLinkedOrganizationPayload(linkedToOrganizationId: string) {
  return linkedToOrganizationId ? Number(linkedToOrganizationId) : null;
}
