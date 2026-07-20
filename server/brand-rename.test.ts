import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const legacyBrand = ["Noti", "ficadora"].join("");
const publicBrandFiles = [
  "client/index.html",
  "client/src/pages/Home.tsx",
  "client/src/pages/Access.tsx",
  "client/src/components/DashboardLayout.tsx",
  "server/email.ts",
  "server/_core/env.ts",
  "server/_core/oauth.ts",
  "server/campaign-service.ts",
  "README.md",
  "docs/README.md",
  "docs/architecture.md",
  "docs/design-system.md",
  "docs/security-access-matrix.md",
  "docs/privacy-lgpd.md",
  "docs/operations-runbook.md",
  "docs/deployment-checklist.md",
];

describe("identidade SPC Informa", () => {
  it("usa a nova marca e elimina a marca anterior das superfícies públicas", () => {
    const content = publicBrandFiles
      .map(file => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(content).toContain("SPC Informa");
    expect(content.toLocaleLowerCase("pt-BR")).not.toContain(
      legacyBrand.toLocaleLowerCase("pt-BR"),
    );
  });
});
