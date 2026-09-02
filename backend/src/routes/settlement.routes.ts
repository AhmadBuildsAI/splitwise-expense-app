import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireGroupMember } from "../middleware/auth";
import * as settlementController from "../controllers/settlement.controller";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireGroupMember);

router.post("/", asyncHandler(settlementController.createSettlement));
router.get("/", asyncHandler(settlementController.listSettlements));

export default router;