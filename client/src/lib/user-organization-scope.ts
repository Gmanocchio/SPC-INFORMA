export type UserOrganizationOption = {
  id: number;
  parentOrganizationId: number | null;
  linkedToOrganizationId: number | null;
  type: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
  tradeName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

export function creditsRequesterOrganizationOptions(
  organizations: UserOrganizationOption[] | undefined,
  distributorOrganizationId: number | undefined,
) {
  if (!organizations || !distributorOrganizationId) return [];
  return organizations
    .filter(organization => (
      organization.type === "CREDITOR"
      && organization.status === "ACTIVE"
      && (organization.linkedToOrganizationId ?? organization.parentOrganizationId) === distributorOrganizationId
    ))
    .sort((left, right) => left.tradeName.localeCompare(right.tradeName, "pt-BR"));
}
