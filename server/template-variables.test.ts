import { getTableColumns } from "drizzle-orm";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { campaignRecipients } from "../drizzle/schema";
import { assertCampaignImportColumns, campaignImportLayout, campaignRecipientPersistenceValues, campaignTemplateSnapshotValues, normalizeCampaignImportRow } from "./campaign-service";
import { validateTemplateInput } from "./template-service";
import {
  CAMPAIGN_IMPORT_COLUMNS,
  EMAIL_CAMPAIGN_IMPORT_COLUMNS,
  campaignImportCsvHeader,
  campaignImportHeaderRow,
  extractTemplateVariables,
  insertTemplateVariableAtSelection,
  TEMPLATE_VARIABLE_KEYS,
  templateVariablesForChannel,
} from "../shared/template-variables";

describe("variáveis homologadas de template", () => {
  const validRow = {
    CPF: "529.982.247-25",
    "Nome do cliente": "Ana Maria",
    "Nome do credor": "Credor Brasil",
    Valor: "R$ 1.234,56",
    "Data de vencimento": "31/12/2026",
    "Número do contrato": "CTR-2026-001",
    "Números de contato do credor (telefone)": "(11) 4000-1234",
    "E-mail de contato do credor": "COBRANCA@CREDOR.COM.BR",
    Link: "https://credor.example/negociar/CTR-2026-001",
  };
  const validEmailRow = { ...validRow, "E-mail do cliente": "CLIENTE@EXAMPLE.COM.BR" };

  it("preserva nome, versão, assunto, conteúdo e variáveis ao vincular o template à campanha", () => {
    expect(campaignTemplateSnapshotValues({
      name: "Cobrança homologada",
      version: 4,
      subject: "Olá {{nome_cliente}}",
      content: "Contrato {{numero_contrato}}",
      variables: ["nome_cliente", "numero_contrato"],
    } as never)).toEqual({
      templateNameSnapshot: "Cobrança homologada",
      templateVersionSnapshot: 4,
      templateSubjectSnapshot: "Olá {{nome_cliente}}",
      templateContentSnapshot: "Contrato {{numero_contrato}}",
      templateVariablesSnapshot: ["nome_cliente", "numero_contrato"],
    });
  });

  it.each(["SMS", "WHATSAPP", "RCS"] as const)("mantém o layout padrão de nove colunas em %s", channel => {
    expect(campaignImportLayout(channel).columns).toEqual(CAMPAIGN_IMPORT_COLUMNS);
    expect(campaignImportLayout(channel).filename).toBe("modelo-spc-informa.csv");
  });

  it("adiciona somente em E-mail a décima coluna obrigatória do destinatário", () => {
    expect(campaignImportLayout("EMAIL").columns).toEqual(EMAIL_CAMPAIGN_IMPORT_COLUMNS);
    expect(campaignImportLayout("EMAIL").filename).toBe("modelo-spc-informa-email.csv");
    expect(templateVariablesForChannel("EMAIL").map(item => item.key)).toContain("email_cliente");
    expect(templateVariablesForChannel("SMS").map(item => item.key)).not.toContain("email_cliente");
  });

  it("gera o CSV e a primeira linha do XLSX com as mesmas nove colunas na ordem canônica", () => {
    expect(campaignImportCsvHeader()).toBe(`\uFEFF${CAMPAIGN_IMPORT_COLUMNS.join(";")}\r\n`);
    const worksheet = XLSX.utils.aoa_to_sheet([campaignImportHeaderRow()]);
    const [header] = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    expect(header).toEqual(CAMPAIGN_IMPORT_COLUMNS);
  });

  it("insere a variável exatamente na posição do cursor", () => {
    const result = insertTemplateVariableAtSelection("Olá , continue.", "nome_cliente", 4, 4);
    expect(result).toEqual({ value: "Olá {{nome_cliente}}, continue.", selectionStart: 20, selectionEnd: 20 });
  });

  it("substitui apenas o trecho selecionado e posiciona o cursor após a variável", () => {
    const result = insertTemplateVariableAtSelection("Olá cliente, continue.", "cpf", 4, 11);
    expect(result.value).toBe("Olá {{cpf}}, continue.");
    expect(result.selectionStart).toBe("Olá {{cpf}}".length);
    expect(result.selectionEnd).toBe(result.selectionStart);
  });

  it("detecta variáveis no assunto e no conteúdo sem duplicidade", () => {
    expect(extractTemplateVariables("Olá {{nome_cliente}}", "CPF {{cpf}} de {{nome_cliente}}"))
      .toEqual(["cpf", "nome_cliente"]);
  });

  it("aceita as variáveis homologadas e rejeita variáveis ausentes da planilha", () => {
    expect(() => validateTemplateInput("SMS", null, "Olá {{nome_cliente}}, valor {{valor}} com {{nome_credor}}. {{link}}")).not.toThrow();
    expect(() => validateTemplateInput("SMS", null, "Olá {{nome}}.")).toThrow(/Variáveis não disponíveis: \{\{nome\}\}/);
    expect(() => validateTemplateInput("EMAIL", "Contato {{email_cliente}}", "Olá {{nome_cliente}}.")).not.toThrow();
    expect(() => validateTemplateInput("SMS", null, "Contato {{email_cliente}}.")).toThrow(/Variáveis não disponíveis/);
  });

  it("expõe as nove variáveis padrão e `email_cliente` exclusivo do layout de E-mail", () => {
    expect(TEMPLATE_VARIABLE_KEYS).toEqual(["cpf", "nome_cliente", "nome_credor", "valor", "data_vencimento", "numero_contrato", "telefone_credor", "email_credor", "link", "email_cliente"]);
  });

  it("normaliza e grava valores canônicos para personalização e persistência", () => {
    const normalized = normalizeCampaignImportRow(validRow);
    expect(normalized.errors).toEqual([]);
    expect(normalized).toMatchObject({
      cpf: "52998224725",
      customerName: "Ana Maria",
      customerEmail: "",
      creditorName: "Credor Brasil",
      amountCents: 123456,
      dueDate: "2026-12-31",
      contractNumber: "CTR-2026-001",
      creditorPhone: "1140001234",
      creditorEmail: "cobranca@credor.com.br",
      link: "https://credor.example/negociar/CTR-2026-001",
    });
    expect(normalized.variables).toEqual({
      cpf: "52998224725",
      nome_cliente: "Ana Maria",
      nome_credor: "Credor Brasil",
      valor: "R$ 1.234,56",
      data_vencimento: "31/12/2026",
      numero_contrato: "CTR-2026-001",
      telefone_credor: "1140001234",
      email_credor: "cobranca@credor.com.br",
      link: "https://credor.example/negociar/CTR-2026-001",
      email_cliente: "",
    });
    expect(campaignRecipientPersistenceValues(normalized)).toEqual({
      cpf: "52998224725",
      customerName: "Ana Maria",
      customerEmail: "",
      creditorName: "Credor Brasil",
      amountCents: 123456,
      dueDate: "2026-12-31",
      contractNumber: "CTR-2026-001",
      creditorPhone: "1140001234",
      creditorEmail: "cobranca@credor.com.br",
      link: "https://credor.example/negociar/CTR-2026-001",
    });
  });

  it("materializa no schema os dez campos persistidos por destinatário", () => {
    expect(Object.keys(getTableColumns(campaignRecipients))).toEqual(expect.arrayContaining([
      "cpfCiphertext",
      "customerNameCiphertext",
      "customerEmailCiphertext",
      "creditorNameCiphertext",
      "amountCents",
      "dueDate",
      "contractNumberCiphertext",
      "creditorPhoneCiphertext",
      "creditorEmailCiphertext",
      "linkCiphertext",
    ]));
  });

  it("rejeita colunas faltantes, extras ou fora da ordem do modelo", () => {
    expect(() => assertCampaignImportColumns(validRow)).not.toThrow();
    expect(() => assertCampaignImportColumns({ [`\uFEFF${CAMPAIGN_IMPORT_COLUMNS[0]}`]: validRow.CPF, ...Object.fromEntries(Object.entries(validRow).slice(1)) })).not.toThrow();
    const { CPF: _cpf, ...missingCpf } = validRow;
    expect(() => assertCampaignImportColumns(missingCpf)).toThrow(/faltando: CPF/);
    expect(() => assertCampaignImportColumns({ ...validRow, Observação: "extra" })).toThrow(/não permitidas: Observação/);
    expect(() => assertCampaignImportColumns(Object.fromEntries(Object.entries(validRow).reverse()))).toThrow(/ordem das colunas diferente/);
    expect(() => assertCampaignImportColumns(validRow, "EMAIL")).toThrow(/faltando: E-mail do cliente/);
    expect(() => assertCampaignImportColumns(validEmailRow, "EMAIL")).not.toThrow();
  });

  it("normaliza e exige o e-mail do cliente somente no canal E-mail", () => {
    const normalized = normalizeCampaignImportRow(validEmailRow, "EMAIL");
    expect(normalized.errors).toEqual([]);
    expect(normalized.customerEmail).toBe("cliente@example.com.br");
    expect(normalized.variables.email_cliente).toBe("cliente@example.com.br");
    expect(normalizeCampaignImportRow(validRow, "EMAIL").errors.map(error => error.code)).toContain("INVALID_CUSTOMER_EMAIL");
    expect(normalizeCampaignImportRow(validRow, "SMS").errors.map(error => error.code)).not.toContain("INVALID_CUSTOMER_EMAIL");
  });

  it("retorna mensagens por campo quando uma linha possui dados inválidos", () => {
    const normalized = normalizeCampaignImportRow(Object.fromEntries(CAMPAIGN_IMPORT_COLUMNS.map(column => [column, ""])));
    expect(normalized.errors.map(error => error.code)).toEqual([
      "INVALID_CPF",
      "INVALID_CUSTOMER_NAME",
      "INVALID_CREDITOR_NAME",
      "INVALID_AMOUNT",
      "INVALID_DUE_DATE",
      "INVALID_CONTRACT_NUMBER",
      "INVALID_CREDITOR_PHONE",
      "INVALID_CREDITOR_EMAIL",
      "INVALID_LINK",
    ]);
  });
});
