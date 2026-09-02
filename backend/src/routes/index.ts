import { Router } from "express";
import authRoutes from "./auth.routes";
import groupRoutes from "./group.routes";
import dashboardRoutes from "./dashboard.routes";
import { groupExpenseRouter, expenseRouter } from "./expense.routes";
import { balanceRouter } from "./balance.routes";
import settlementRouter from "./settlement.routes";
import { activityRouter } from "./activity.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/groups", groupRoutes);
router.use("/groups/:groupId/expenses", groupExpenseRouter);
router.use("/groups/:groupId/balances", balanceRouter);
router.use("/groups/:groupId/settlements", settlementRouter);
router.use("/groups/:groupId/activity", activityRouter);
router.use("/expenses", expenseRouter);
router.use("/dashboard", dashboardRoutes);

export default router;
