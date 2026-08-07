import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";

export const CREDITS_PREFIX = "/credits-informa";
export const CREDITS_ORGANIZATION_ID = 90002;

const SPC_LOGO_URL = "/manus-storage/logo-spcbrasil_2505cb7b.webp";
const CREDITS_LOGO_URL = "/manus-storage/credits-logo_84d116fc.png";
const CREDITS_SYMBOL_URL = "/manus-storage/credits-symbol_343e47e1.png";

export type BrandId = "spc" | "credits";

export type BrandContextValue = {
  id: BrandId;
  isCredits: boolean;
  productName: "SPC Informa" | "Credits Informa";
  organizationName: "SPC Brasil" | "Credits Brasil";
  logoUrl: string;
  symbolUrl?: string;
  homePath: string;
  accessPath: string;
  recoveryPath: string;
  appPath: string;
  firstAccessPath: string;
  toPath: (path: string) => string;
  localizeText: (text: string) => string;
};

const spcBrand: BrandContextValue = {
  id: "spc",
  isCredits: false,
  productName: "SPC Informa",
  organizationName: "SPC Brasil",
  logoUrl: SPC_LOGO_URL,
  symbolUrl: SPC_LOGO_URL,
  homePath: "/",
  accessPath: "/acesso",
  recoveryPath: "/recuperar-senha",
  appPath: "/app",
  firstAccessPath: "/app/primeiro-acesso",
  toPath: path => path,
  localizeText: text => text,
};

function creditsPath(path: string) {
  if (path === CREDITS_PREFIX || path.startsWith(`${CREDITS_PREFIX}/`)) return path;
  if (path === "/") return CREDITS_PREFIX;
  return `${CREDITS_PREFIX}${path}`;
}

const creditsBrand: BrandContextValue = {
  id: "credits",
  isCredits: true,
  productName: "Credits Informa",
  organizationName: "Credits Brasil",
  logoUrl: CREDITS_LOGO_URL,
  symbolUrl: CREDITS_SYMBOL_URL,
  homePath: CREDITS_PREFIX,
  accessPath: `${CREDITS_PREFIX}/acesso`,
  recoveryPath: `${CREDITS_PREFIX}/recuperar-senha`,
  appPath: `${CREDITS_PREFIX}/app`,
  firstAccessPath: `${CREDITS_PREFIX}/app/primeiro-acesso`,
  toPath: creditsPath,
  localizeText: text => text
    .replaceAll("SPC INFORMA", "CREDITS INFORMA")
    .replaceAll("SPC Informa", "Credits Informa"),
};

const BrandContext = createContext<BrandContextValue>(spcBrand);

export function isCreditsPath(pathname: string) {
  return pathname === CREDITS_PREFIX || pathname.startsWith(`${CREDITS_PREFIX}/`);
}

export function isCreditsOrganization(user: {
  user?: { role?: string };
  organization?: { id?: number; type?: string; tradeName?: string };
} | null | undefined) {
  return Boolean(
    user?.organization
    && user.organization.id === CREDITS_ORGANIZATION_ID
    && user.organization.type === "DISTRIBUTOR",
  );
}

export function isCreditsOrganizationAdmin(user: {
  user?: { role?: string };
  organization?: { id?: number; type?: string; tradeName?: string };
} | null | undefined) {
  return isCreditsOrganization(user) && user?.user?.role === "ORG_ADMIN";
}

export function isCreditsPortalUser(user: {
  user?: { role?: string };
  organization?: {
    id?: number;
    type?: string;
    status?: string;
    parentOrganizationId?: number | null;
    linkedToOrganizationId?: number | null;
  };
} | null | undefined) {
  if (isCreditsOrganizationAdmin(user)) return true;
  return Boolean(
    user?.user?.role === "REQUESTER"
    && user.organization?.type === "CREDITOR"
    && user.organization.status === "ACTIVE"
    && (user.organization.linkedToOrganizationId ?? user.organization.parentOrganizationId) === CREDITS_ORGANIZATION_ID,
  );
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const brand = useMemo(() => isCreditsPath(location) ? creditsBrand : spcBrand, [location]);

  useEffect(() => {
    document.documentElement.classList.toggle("credits-brand", brand.isCredits);
    document.title = brand.productName;

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (description) {
      description.content = brand.isCredits
        ? "Credits Informa — gestão segura de campanhas multicanal, organizações, preços e resultados."
        : "SPC Informa — gestão segura de campanhas multicanal, organizações, preços e resultados.";
    }
    if (themeColor) themeColor.content = brand.isCredits ? "#243871" : "#004A99";

    const faviconId = "runtime-brand-favicon";
    const existingFavicon = document.getElementById(faviconId);
    const favicon = existingFavicon instanceof HTMLLinkElement
      ? existingFavicon
      : Object.assign(document.createElement("link"), { id: faviconId, rel: "icon" });
    favicon.href = brand.symbolUrl ?? brand.logoUrl;
    if (!favicon.isConnected) document.head.appendChild(favicon);
  }, [brand]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
