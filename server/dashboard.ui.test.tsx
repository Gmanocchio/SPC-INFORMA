// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../client/src/pages/Dashboard";

const mocks = vi.hoisted(() => ({
  currentUser: null as null | {
    user: { role: string };
    organization: { type: string };
  },
}));

const overviewData = {
  periodStart: Date.UTC(2026, 5, 1),
  sent: 10,
  delivered: 8,
  failed: 2,
  campaignCount: 1,
  deliveryRate: 80,
  processedMicros: 1_300_000,
  byChannel: [],
  byDay: [],
  byMonth: [],
  financial: null,
  byOrganization: [
    {
      organizationId: 1,
      organizationName: "SPC Brasil",
      organizationType: "SPC_BRASIL",
      sent: 10,
      delivered: 8,
      processedMicros: 1_300_000,
    },
  ],
};

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.currentUser }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dashboard: {
      overview: {
        useQuery: () => ({
          data: overviewData,
          isLoading: false,
          isError: false,
          error: null,
        }),
      },
    },
  },
}));

afterEach(() => cleanup());

describe("Dashboard por tipo de organização", () => {
  it("mantém os indicadores próprios e oculta o consolidado para usuário credor", () => {
    mocks.currentUser = {
      user: { role: "ORG_REQUESTER" },
      organization: { type: "CREDITOR" },
    };

    render(<Dashboard />);

    expect(screen.getByText("Envios no período")).toBeTruthy();
    expect(screen.queryByTestId("organization-consolidation")).toBeNull();
    expect(screen.queryByText("Consolidado por organização")).toBeNull();
  });

  it("mantém o consolidado para administrador do SPC Brasil", () => {
    mocks.currentUser = {
      user: { role: "SPC_ADMIN" },
      organization: { type: "SPC_BRASIL" },
    };

    render(<Dashboard />);

    expect(screen.getByTestId("organization-consolidation")).toBeTruthy();
    expect(screen.getByText("Consolidado por organização")).toBeTruthy();
  });
});
