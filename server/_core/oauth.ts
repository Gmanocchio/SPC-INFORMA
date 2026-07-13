import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req, res) => {
    res.status(410).json({
      error: "OAuth desativado. Utilize o login próprio da Notificadora.",
    });
  });
}
