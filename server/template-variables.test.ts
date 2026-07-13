import { describe, expect, it } from "vitest";
import { campaignImportLayout } from "./campaign-service";
import { validateTemplateInput } from "./template-service";
import {
  extractTemplateVariables,
  insertTemplateVariableAtSelection,
  TEMPLATE_VARIABLE_KEYS,
} from "../shared/template-variables";

describe("variáveis homologadas de template", () => {
  it.each(["SMS", "EMAIL", "WHATSAPP", "RCS"] as const)("mantém o seletor alinhado ao layout de %s", channel => {
    expect(campaignImportLayout(channel).columns.slice(1)).toEqual(TEMPLATE_VARIABLE_KEYS);
  });

  it("insere a variável exatamente na posição do cursor", () => {
    const result = insertTemplateVariableAtSelection("Olá , continue.", "nome", 4, 4);
    expect(result).toEqual({ value: "Olá {{nome}}, continue.", selectionStart: 12, selectionEnd: 12 });
  });

  it("substitui apenas o trecho selecionado e posiciona o cursor após a variável", () => {
    const result = insertTemplateVariableAtSelection("Olá cliente, continue.", "documento", 4, 11);
    expect(result.value).toBe("Olá {{documento}}, continue.");
    expect(result.selectionStart).toBe("Olá {{documento}}".length);
    expect(result.selectionEnd).toBe(result.selectionStart);
  });

  it("detecta variáveis no assunto e no conteúdo sem duplicidade", () => {
    expect(extractTemplateVariables("Olá {{nome}}", "Documento {{documento}} de {{nome}}"))
      .toEqual(["documento", "nome"]);
  });

  it("aceita as variáveis homologadas e rejeita variáveis ausentes da planilha", () => {
    expect(() => validateTemplateInput("SMS", null, "Olá {{nome}}, valor {{valor}}.")).not.toThrow();
    expect(() => validateTemplateInput("SMS", null, "Olá {{contrato}}.")).toThrow(/Variáveis não disponíveis: \{\{contrato\}\}/);
  });
});
