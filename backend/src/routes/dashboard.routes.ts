import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as dashboardController from "../controllers/dashboard.controller";

const router = Router();
router.get("/", requireAuth, asyncHandler(dashboardController.dashboard));

export default router;
