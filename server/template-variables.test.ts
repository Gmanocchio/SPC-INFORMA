import { describe, expect, it } from "vitest";
import { assertCampaignImportColumns, campaignImportLayout, normalizeCampaignImportRow } from "./campaign-service";
import { validateTemplateInput } from "./template-service";
import {
  CAMPAIGN_IMPORT_COLUMNS,
  extractTemplateVariables,
  insertTemplateVariableAtSelection,
  TEMPLATE_VARIABLE_KEYS,
} from "../shared/template-variables";

describe("variáveis homologadas de template", () => {
  const validRow = {
    CPF: "529.982.247-25",
    "Nome do cliente (primeiro nome)": "Ana Maria",
    "Valor da dívida": "R$ 1.234,56",
    "Vencimento da dívida": "31/12/2026",
    "Número do contrato": "CTR-2026-001",
    "Telefone do credor": "(11) 4000-1234",
    "E-mail do credor": "COBRANCA@CREDOR.COM.BR",
  };

  it.each(["SMS", "EMAIL", "WHATSAPP", "RCS"] as const)("mantém o seletor alinhado ao layout de %s", channel => {
    expect(campaignImportLayout(channel).columns).toEqual(CAMPAIGN_IMPORT_COLUMNS);
    expect(campaignImportLayout(channel).filename).toBe("modelo-notificadora-spc.csv");
  });

  it("insere a variável exatamente na posição do cursor", () => {
    const result = insertTemplateVariableAtSelection("Olá , continue.", "primeiro_nome", 4, 4);
    expect(result).toEqual({ value: "Olá {{primeiro_nome}}, continue.", selectionStart: 21, selectionEnd: 21 });
  });

  it("substitui apenas o trecho selecionado e posiciona o cursor após a variável", () => {
    const result = insertTemplateVariableAtSelection("Olá cliente, continue.", "cpf", 4, 11);
    expect(result.value).toBe("Olá {{cpf}}, continue.");
    expect(result.selectionStart).toBe("Olá {{cpf}}".length);
    expect(result.selectionEnd).toBe(result.selectionStart);
  });

  it("detecta variáveis no assunto e no conteúdo sem duplicidade", () => {
    expect(extractTemplateVariables("Olá {{primeiro_nome}}", "CPF {{cpf}} de {{primeiro_nome}}"))
      .toEqual(["cpf", "primeiro_nome"]);
  });

  it("aceita as variáveis homologadas e rejeita variáveis ausentes da planilha", () => {
    expect(() => validateTemplateInput("SMS", null, "Olá {{primeiro_nome}}, valor {{valor_divida}}.")).not.toThrow();
    expect(() => validateTemplateInput("SMS", null, "Olá {{nome}}.")).toThrow(/Variáveis não disponíveis: \{\{nome\}\}/);
  });

  it("expõe exatamente as sete variáveis do layout padrão", () => {
    expect(TEMPLATE_VARIABLE_KEYS).toEqual(["cpf", "primeiro_nome", "valor_divida", "vencimento_divida", "numero_contrato", "telefone_credor", "email_credor"]);
  });

  it("normaliza e grava valores canônicos para personalização e persistência", () => {
    const normalized = normalizeCampaignImportRow(validRow);
    expect(normalized.errors).toEqual([]);
    expect(normalized).toMatchObject({
      cpf: "52998224725",
      firstName: "Ana",
      debtAmountCents: 123456,
      debtDueDate: "2026-12-31",
      contractNumber: "CTR-2026-001",
      creditorPhone: "1140001234",
      creditorEmail: "cobranca@credor.com.br",
    });
    expect(normalized.variables).toEqual({
      cpf: "52998224725",
      primeiro_nome: "Ana",
      valor_divida: "R$ 1.234,56",
      vencimento_divida: "31/12/2026",
      numero_contrato: "CTR-2026-001",
      telefone_credor: "1140001234",
      email_credor: "cobranca@credor.com.br",
    });
  });

  it("rejeita colunas faltantes, extras ou fora da ordem do modelo", () => {
    expect(() => assertCampaignImportColumns(validRow)).not.toThrow();
    expect(() => assertCampaignImportColumns({ [`\uFEFF${CAMPAIGN_IMPORT_COLUMNS[0]}`]: validRow.CPF, ...Object.fromEntries(Object.entries(validRow).slice(1)) })).not.toThrow();
    const { CPF: _cpf, ...missingCpf } = validRow;
    expect(() => assertCampaignImportColumns(missingCpf)).toThrow(/faltando: CPF/);
    expect(() => assertCampaignImportColumns({ ...validRow, Observação: "extra" })).toThrow(/não permitidas: Observação/);
    expect(() => assertCampaignImportColumns(Object.fromEntries(Object.entries(validRow).reverse()))).toThrow(/ordem das colunas diferente/);
  });

  it("retorna mensagens por campo quando uma linha possui dados inválidos", () => {
    const normalized = normalizeCampaignImportRow(Object.fromEntries(CAMPAIGN_IMPORT_COLUMNS.map(column => [column, ""])));
    expect(normalized.errors.map(error => error.code)).toEqual([
      "INVALID_CPF",
      "INVALID_FIRST_NAME",
      "INVALID_DEBT_AMOUNT",
      "INVALID_DEBT_DUE_DATE",
      "INVALID_CONTRACT_NUMBER",
      "INVALID_CREDITOR_PHONE",
      "INVALID_CREDITOR_EMAIL",
    ]);
  });
});
