import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireGroupMember } from "../middleware/auth";
import * as activityController from "../controllers/activity.controller";

export const activityRouter = Router({ mergeParams: true });
activityRouter.use(requireAuth, requireGroupMember);
activityRouter.get("/", asyncHandler(activityController.listActivity));
