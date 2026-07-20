import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fromLinkedOrganizationSelectValue,
  SPC_BRASIL_LINK_VALUE,
  toLinkedOrganizationPayload,
  toLinkedOrganizationSelectValue,
} from "../client/src/pages/organization-form-state";

describe("estado do vínculo no formulário de empresas", () => {
  it("representa SPC Brasil com um valor não vazio aceito pelo Radix Select", () => {
    expect(SPC_BRASIL_LINK_VALUE).not.toBe("");
    expect(toLinkedOrganizationSelectValue("")).toBe(SPC_BRASIL_LINK_VALUE);
    expect(fromLinkedOrganizationSelectValue(SPC_BRASIL_LINK_VALUE)).toBe("");
    expect(toLinkedOrganizationPayload("")).toBeNull();
  });

  it("preserva o id da CDL ou distribuidora entre seleção e payload", () => {
    expect(toLinkedOrganizationSelectValue("42")).toBe("42");
    expect(fromLinkedOrganizationSelectValue("42")).toBe("42");
    expect(toLinkedOrganizationPayload("42")).toBe(42);
  });

  it("não renderiza SelectItem com value vazio nos fluxos de criação e edição", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Organizations.tsx"), "utf8");
    expect(source).not.toMatch(/<SelectItem[^>]*value=""/);
    expect(source).toContain("value={SPC_BRASIL_LINK_VALUE}");
    expect(source).toContain("toLinkedOrganizationSelectValue(form.linkedToOrganizationId)");
  });
});
