import { authenticatedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { dashboardOverview } from "../dashboard-service";
export const dashboardRouter = router({
  overview: authenticatedProcedure
    .input(z.object({ creditorOrganizationId: z.number().int().positive().optional() }).optional())
    .query(({ ctx, input }) => dashboardOverview(
      { organizationId: ctx.user.organizationId, role: ctx.user.role },
      input?.creditorOrganizationId,
    )),
});
