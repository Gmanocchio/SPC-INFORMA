export type PricingChannel = "EMAIL" | "SMS" | "WHATSAPP" | "RCS";

export const PRICING_CHANNELS: PricingChannel[] = ["EMAIL", "SMS", "WHATSAPP", "RCS"];

export const PRICING_CHANNEL_LABELS: Record<PricingChannel, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  RCS: "RCS",
};

export type PricingRule = {
  id: number;
  organizationId: number;
  creditorOrganizationId: number | null;
  channel: PricingChannel;
  priceType: "SPC_BASE" | "CREDITOR_PRICE";
  unitPriceMicros: number;
  validFrom: Date;
  validUntil: Date | null;
  active: boolean;
};

export type PricingOrganization = {
  id: number;
  parentOrganizationId: number | null;
  type: "SPC_BRASIL" | "CDL" | "DISTRIBUTOR" | "CREDITOR";
  legalName: string;
  tradeName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

export type PricingMatrixRow = {
  key: string;
  name: string;
  ownerName: string | null;
  organizationId: number;
  creditorOrganizationId: number | null;
  priceType: "SPC_BASE" | "CREDITOR_PRICE";
};

type BuildRowsInput = {
  organizations: PricingOrganization[];
  actorOrganizationId: number;
  isSpcAdmin: boolean;
};

const displayName = (organization: PricingOrganization) =>
  organization.tradeName.trim() || organization.legalName.trim();

export function buildPricingMatrixRows({ organizations, actorOrganizationId, isSpcAdmin }: BuildRowsInput) {
  const ownerById = new Map(
    organizations
      .filter(organization => ["SPC_BRASIL", "CDL", "DISTRIBUTOR"].includes(organization.type))
      .map(organization => [organization.id, displayName(organization)]),
  );

  const creditors = organizations
    .filter(organization =>
      organization.type === "CREDITOR"
      && organization.status === "ACTIVE"
      && organization.parentOrganizationId !== null
      && (isSpcAdmin || organization.parentOrganizationId === actorOrganizationId),
    )
    .sort((left, right) => displayName(left).localeCompare(displayName(right), "pt-BR"));

  const rows: PricingMatrixRow[] = creditors.map(creditor => ({
    key: `creditor-${creditor.id}`,
    name: displayName(creditor),
    ownerName: creditor.parentOrganizationId ? ownerById.get(creditor.parentOrganizationId) ?? "Organização responsável" : null,
    organizationId: creditor.parentOrganizationId!,
    creditorOrganizationId: creditor.id,
    priceType: "CREDITOR_PRICE",
  }));

  // Exibir Base SPC Brasil como primeira linha para todos os perfis administrativos
  const spcOrganization = organizations.find(org => org.type === "SPC_BRASIL");
  if (spcOrganization) {
    rows.unshift({
      key: "spc-base",
      name: "Base SPC Brasil",
      ownerName: "Referência geral",
      organizationId: spcOrganization.id,
      creditorOrganizationId: null,
      priceType: "SPC_BASE",
    });
  }

  return rows;
}

export function findCellRules(rules: PricingRule[], row: PricingMatrixRow, channel: PricingChannel) {
  const matching = rules
    .filter(rule =>
      rule.channel === channel
      && rule.priceType === row.priceType
      && rule.organizationId === row.organizationId
      && rule.creditorOrganizationId === row.creditorOrganizationId,
    )
    .sort((left, right) => new Date(right.validFrom).getTime() - new Date(left.validFrom).getTime());

  return {
    activeRule: matching.find(rule => rule.active) ?? null,
    latestRule: matching[0] ?? null,
  };
}
