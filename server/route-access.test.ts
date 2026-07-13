import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { protectedRouteDecision } from "../client/src/lib/route-access";

const authenticatedUser = (role: string, mustChangePassword = false) => ({
  user: { role, mustChangePassword },
});

describe("proteção automatizada das rotas do painel", () => {
  it("mantém a rota de campanhas atrás de ProtectedPage", () => {
    const source = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    expect(source).toContain(
      '<Route path="/app/campanhas">{() => <ProtectedPage><Campaigns /></ProtectedPage>}</Route>',
    );
  });

  it("redireciona visitante anônimo de qualquer rota protegida para o acesso", () => {
    expect(protectedRouteDecision({ loading: false, user: null })).toEqual({
      status: "redirect",
      path: "/acesso",
    });
  });

  it("não decide durante o carregamento da sessão", () => {
    expect(protectedRouteDecision({ loading: true, user: null })).toEqual({ status: "loading" });
  });

  it("exige a troca de senha antes de liberar o painel", () => {
    expect(
      protectedRouteDecision({
        loading: false,
        user: authenticatedUser("SPC_ADMIN", true),
      }),
    ).toEqual({ status: "redirect", path: "/app/primeiro-acesso" });
  });

  it("libera campanhas para uma sessão válida e mantém módulos SPC restritos", () => {
    const user = authenticatedUser("SOLICITANTE");
    expect(protectedRouteDecision({ loading: false, user })).toEqual({ status: "allow" });
    expect(protectedRouteDecision({ loading: false, user, spcOnly: true })).toEqual({
      status: "redirect",
      path: "/app",
    });
  });
});
