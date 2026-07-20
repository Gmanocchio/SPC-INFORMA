import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { processCampaignQueue } from "./campaign-processing-service";
import { cleanupExpiredAuthArtifacts } from "./db";
import { cleanupExpiredPersonalData } from "./retention-service";

type CronIdentity = { isCron?: boolean; taskUid?: string };

export function createProcessCampaignsHandler(
  authenticate: (req: Request) => Promise<CronIdentity> = req => sdk.authenticateRequest(req),
  processQueue: typeof processCampaignQueue = processCampaignQueue,
  runMaintenance: () => Promise<unknown> = async () => {
    await cleanupExpiredAuthArtifacts();
    return cleanupExpiredPersonalData();
  },
) {
  return async function processCampaigns(req: Request, res: Response) {
    let user: CronIdentity;
    try {
      user = await authenticate(req);
    } catch {
      return res.status(401).json({ error: "invalid-scheduled-auth" });
    }
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    try {
      const result = await processQueue({ campaignLimit: 5, recipientLimit: 100, concurrency: 8 });
      const retention = await runMaintenance();
      return res.json({ ok: true, taskUid: user.taskUid, retention, ...result });
    } catch (error) {
      console.error("[scheduled:campaigns] processing failed", { taskUid: user.taskUid, error });
      return res.status(500).json({ error: "campaign-processing-failed", taskUid: user.taskUid, timestamp: new Date().toISOString() });
    }
  };
}

export const processCampaigns = createProcessCampaignsHandler();

export function registerScheduledRoutes(app: Express) {
  app.post("/api/scheduled/process-campaigns", processCampaigns);
}
