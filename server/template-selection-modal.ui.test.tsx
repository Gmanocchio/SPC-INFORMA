// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateSelectionModal } from "../client/src/components/TemplateSelectionModal";

const availableTemplates = [
  {
    id: 510001,
    publicId: "TP-510001",
    name: "SMS Cobrança amigável",
    channel: "SMS" as const,
    subject: null,
    content: "Olá {{nome_cliente}}, negocie com {{nome_credor}}.",
    variables: ["nome_cliente", "nome_credor"],
    version: 1,
  },
  {
    id: 510002,
    publicId: "TP-510002",
    name: "E-mail Cobrança amigável",
    channel: "EMAIL" as const,
    subject: "Negocie sua pendência",
    content: "Olá {{nome_cliente}}.",
    variables: ["nome_cliente"],
    version: 1,
  },
];

afterEach(() => cleanup());

describe("TemplateSelectionModal", () => {
  it("renderiza e seleciona template ativo retornado pela API mesmo sem campo status", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <TemplateSelectionModal
        open
        onOpenChange={onOpenChange}
        templates={availableTemplates}
        isLoading={false}
        isError={false}
        onSelect={onSelect}
        selectedChannel="SMS"
      />,
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("lg:max-w-6xl");
    expect(dialog.className).toContain("w-[calc(100vw-1.5rem)]");
    expect(dialog.className).toContain("sm:max-w-[calc(100vw-3rem)]");
    expect(within(dialog).getByTestId("template-grid").className).toContain("lg:grid-cols-2");
    expect(within(dialog).getByTestId("template-card-510001").className).toContain("min-h-[30rem]");
    expect(within(dialog).getByText("TP-510001")).toBeTruthy();
    expect(within(dialog).getByText("SMS Cobrança amigável")).toBeTruthy();
    expect(within(dialog).queryByText("E-mail Cobrança amigável")).toBeNull();
    expect(within(dialog).queryByText("Nenhum template disponível")).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Selecionar" }));

    expect(onSelect).toHaveBeenCalledWith(510001);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
