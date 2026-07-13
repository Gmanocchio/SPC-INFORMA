import { authenticatedProcedure, router } from "../_core/trpc";
import { dashboardOverview } from "../dashboard-service";

export const dashboardRouter = router({
  overview: authenticatedProcedure.query(({ ctx }) => dashboardOverview({ organizationId: ctx.user.organizationId, role: ctx.user.role })),
});
