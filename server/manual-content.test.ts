import { describe, expect, it } from "vitest";
import {
  filterManualChapters,
  getManualReadingMinutes,
  getVisibleManualChapters,
  MANUAL_CHAPTERS,
} from "../client/src/lib/manual-content";

describe("conteúdo do Manual por perfil", () => {
  it("entrega todos os capítulos para o nível SPC", () => {
    const chapters = getVisibleManualChapters({ role: "SPC_ADMIN", organizationType: "SPC_BRASIL" });
    expect(chapters).toHaveLength(MANUAL_CHAPTERS.length);
    expect(chapters.map(chapter => chapter.id)).toEqual(MANUAL_CHAPTERS.map(chapter => chapter.id));
  });

  it("entrega visão integral para qualquer usuário da organização SPC Brasil", () => {
    const chapters = getVisibleManualChapters({ role: "REQUESTER", organizationType: "SPC_BRASIL" });
    expect(chapters).toHaveLength(MANUAL_CHAPTERS.length);
  });

  it.each(["CDL", "DISTRIBUTOR", "CREDITOR"] as const)(
    "restringe o administrador %s aos módulos administrativos permitidos",
    organizationType => {
      const ids = getVisibleManualChapters({ role: "ORG_ADMIN", organizationType }).map(chapter => chapter.id);
      expect(ids).toEqual(["ACCESS", "DASHBOARD", "CAMPAIGNS", "ORGANIZATIONS", "USERS", "PRICING", "API_KEYS", "HELP"]);
      expect(ids).not.toContain("TEMPLATES");
      expect(ids).not.toContain("BROKERS");
      expect(ids).not.toContain("DOMAINS");
    },
  );

  it.each(["CDL", "DISTRIBUTOR", "CREDITOR"] as const)(
    "restringe o solicitante %s às telas operacionais",
    organizationType => {
      const ids = getVisibleManualChapters({ role: "REQUESTER", organizationType }).map(chapter => chapter.id);
      expect(ids).toEqual(["ACCESS", "DASHBOARD", "CAMPAIGNS", "HELP"]);
    },
  );
});

describe("busca e leitura do Manual", () => {
  it("localiza palavras com ou sem acentos", () => {
    expect(filterManualChapters(MANUAL_CHAPTERS, "precificacao").map(chapter => chapter.id)).toContain("PRICING");
    expect(filterManualChapters(MANUAL_CHAPTERS, "usuários perfil").map(chapter => chapter.id)).toContain("USERS");
  });

  it("pesquisa também exemplos, passos e palavras-chave", () => {
    const result = filterManualChapters(MANUAL_CHAPTERS, "planilha agendar");
    expect(result.map(chapter => chapter.id)).toEqual(["CAMPAIGNS"]);
  });

  it("não altera a lista quando a pesquisa está vazia", () => {
    expect(filterManualChapters(MANUAL_CHAPTERS, "   ")).toBe(MANUAL_CHAPTERS);
  });

  it("soma o tempo estimado dos capítulos visíveis", () => {
    const chapters = getVisibleManualChapters({ role: "REQUESTER", organizationType: "CREDITOR" });
    expect(getManualReadingMinutes(chapters)).toBe(chapters.reduce((total, chapter) => total + chapter.estimatedMinutes, 0));
  });
});
