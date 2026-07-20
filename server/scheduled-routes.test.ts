import { describe, expect, it, vi } from "vitest";
import { createProcessCampaignsHandler } from "./scheduled-routes";

function responseRecorder() {
  const state = { status: 200, body: undefined as unknown };
  const response = {
    status(code: number) { state.status = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  };
  return { state, response };
}

describe("callback periódico de campanhas", () => {
  it("rejeita chamadas sem autenticação agendada", async () => {
    const { state, response } = responseRecorder();
    const handler = createProcessCampaignsHandler(async () => { throw new Error("unauthorized"); }, vi.fn());
    await handler({} as never, response as never);
    expect(state.status).toBe(401);
    expect(state.body).toEqual({ error: "invalid-scheduled-auth" });
  });

  it("processa a fila uma vez para identidade cron válida", async () => {
    const { state, response } = responseRecorder();
    const processQueue = vi.fn().mockResolvedValue({ processedAt: "2026-07-12T23:00:00.000Z", campaigns: [] });
    const runMaintenance = vi.fn().mockResolvedValue({ recipientsAnonymized: 3 });
    const handler = createProcessCampaignsHandler(
      async () => ({ isCron: true, taskUid: "task-1" }),
      processQueue,
      runMaintenance,
    );
    await handler({} as never, response as never);
    expect(state.status).toBe(200);
    expect(processQueue).toHaveBeenCalledTimes(1);
    expect(runMaintenance).toHaveBeenCalledTimes(1);
    expect(state.body).toMatchObject({
      ok: true,
      taskUid: "task-1",
      retention: { recipientsAnonymized: 3 },
    });
  });
});
