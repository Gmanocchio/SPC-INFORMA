// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Templates from "../client/src/pages/Templates";
import {
  EMAIL_TEMPLATE_PREVIEW_IMAGES,
  getEmailTemplatePreviewImage,
} from "../client/src/lib/email-template-preview-images";

type TemplateFixture = {
  id: number;
  publicId: string;
  name: string;
  channel: "SMS" | "EMAIL" | "WHATSAPP" | "RCS";
  subject: string | null;
  content: string;
  variables: string[];
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

const mocks = vi.hoisted(() => ({
  templates: [] as TemplateFixture[],
  invalidate: vi.fn(async () => undefined),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ commercial: { templates: { list: { invalidate: mocks.invalidate } } } }),
    commercial: {
      templates: {
        list: {
          useQuery: () => ({
            data: mocks.templates,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          }),
        },
        create: { useMutation: () => ({ mutate: mocks.create, isPending: false }) },
        update: { useMutation: () => ({ mutate: mocks.update, isPending: false }) },
      },
    },
  },
}));

function template(publicId: string, channel: TemplateFixture["channel"] = "EMAIL"): TemplateFixture {
  return {
    id: Number(publicId.replace("TP-", "")),
    publicId,
    name: `Template ${publicId}`,
    channel,
    subject: channel === "EMAIL" ? "Regularize sua situação" : null,
    content: "Olá {{nome_cliente}}, confira as condições disponíveis.",
    variables: ["nome_cliente"],
    version: 1,
    status: "ACTIVE",
  };
}

async function openTemplate(publicId: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Editar Template ${publicId}` }));
  return screen.findByRole("dialog");
}

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { value: () => false, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { value: vi.fn(), configurable: true });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { value: vi.fn(), configurable: true });
});

beforeEach(() => {
  mocks.templates = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("imagens demonstrativas dos templates de E-mail", () => {
  it.each([
    ["TP-330001", "/manus-storage/TP-330001_27be9cd2.png"],
    ["TP-240001", "/manus-storage/TP-240001_92b9d9e5.png"],
    ["TP-300001", "/manus-storage/TP-300001_cb16c371.png"],
    ["TP-390001", "/manus-storage/TP-390001_3f2f021f.png"],
    ["TP-270001", "/manus-storage/TP-270001_b6248e68.png"],
    ["TP-360001", "/manus-storage/TP-360001_a6705d73.png"],
  ])("associa %s ao ativo correto", (publicId, expectedSrc) => {
    expect(getEmailTemplatePreviewImage(publicId)?.src).toBe(expectedSrc);
  });

  it("mantém exatamente os seis IDs fornecidos pelo usuário", () => {
    expect(Object.keys(EMAIL_TEMPLATE_PREVIEW_IMAGES).sort()).toEqual([
      "TP-240001",
      "TP-270001",
      "TP-300001",
      "TP-330001",
      "TP-360001",
      "TP-390001",
    ]);
  });

  it("mostra a imagem abaixo da Pré-visualização segura do E-mail correspondente", async () => {
    mocks.templates = [template("TP-330001")];
    render(<Templates />);

    const dialog = await openTemplate("TP-330001");
    const safePreview = within(dialog).getByLabelText("Pré-visualização segura do template");
    const visual = within(safePreview).getByTestId("email-template-visual-TP-330001");
    const image = within(visual).getByRole("img", { name: "Exemplo visual do e-mail de cobrança amigável do SPC Brasil" });

    expect(within(visual).getByText("Imagem de referência vinculada ao template TP-330001.")).toBeTruthy();
    expect(image.getAttribute("src")).toBe("/manus-storage/TP-330001_27be9cd2.png");
    expect(image.className).toContain("w-full");
    expect(image.className).toContain("h-auto");
    expect(image.className).toContain("max-w-[45rem]");
  });

  it("não mostra imagem para E-mail sem ID mapeado", async () => {
    mocks.templates = [template("TP-999999")];
    render(<Templates />);

    const dialog = await openTemplate("TP-999999");
    expect(within(dialog).queryByText("Exemplo visual do e-mail")).toBeNull();
    expect(getEmailTemplatePreviewImage("TP-999999")).toBeNull();
  });

  it.each(["SMS", "WHATSAPP", "RCS"] as const)("não mostra imagem no canal %s mesmo com ID mapeado", async channel => {
    mocks.templates = [template("TP-330001", channel)];
    render(<Templates />);

    const dialog = await openTemplate("TP-330001");
    expect(within(dialog).queryByTestId("email-template-visual-TP-330001")).toBeNull();
  });

  it("informa indisponibilidade sem quebrar o formulário quando o ativo falha", async () => {
    mocks.templates = [template("TP-240001")];
    render(<Templates />);

    const dialog = await openTemplate("TP-240001");
    fireEvent.error(within(dialog).getByRole("img"));

    expect(within(dialog).getByRole("status").textContent).toContain("temporariamente indisponível");
    expect(within(dialog).getByRole("button", { name: "Salvar nova versão" })).toBeTruthy();
  });
});
