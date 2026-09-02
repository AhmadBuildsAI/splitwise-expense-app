import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireGroupMember } from "../middleware/auth";
import * as balanceController from "../controllers/balance.controller";

export const balanceRouter = Router({ mergeParams: true });
balanceRouter.use(requireAuth, requireGroupMember);
balanceRouter.get("/", asyncHandler(balanceController.getBalances));
