export type CampaignOwnerOption = {
  id: number;
  type: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
};

export type CampaignCreditorOption = {
  id: number;
  parentOrganizationId: number | null;
  linkedToOrganizationId: number | null;
};

export function campaignFormAfterOwnerChange<
  T extends { organizationId: string; creditorOrganizationId: string },
>(form: T, organizationId: string): T {
  return {
    ...form,
    organizationId,
    creditorOrganizationId: "",
  };
}

export function creditorsForCampaignOwner<T extends CampaignCreditorOption>(
  owners: CampaignOwnerOption[],
  creditors: T[],
  ownerId: string,
  isSpcAdmin: boolean,
) {
  const selectedOwner = owners.find(owner => String(owner.id) === ownerId);
  if (!selectedOwner) {
    const ownCreditor = creditors.find(creditor => String(creditor.id) === ownerId);
    return ownCreditor ? [ownCreditor] : [];
  }

  if (isSpcAdmin && selectedOwner.type === "SPC_BRASIL") {
    return creditors.filter(creditor => {
      const ownerOrganizationId = creditor.linkedToOrganizationId ?? creditor.parentOrganizationId;
      return ownerOrganizationId === null || ownerOrganizationId === selectedOwner.id;
    });
  }

  return creditors.filter(creditor => (creditor.linkedToOrganizationId ?? creditor.parentOrganizationId) === selectedOwner.id);
}
