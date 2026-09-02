import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireGroupMember } from "../middleware/auth";
import * as groupController from "../controllers/group.controller";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(groupController.createGroup));
router.get("/", asyncHandler(groupController.listGroups));
router.get("/:groupId", requireGroupMember, asyncHandler(groupController.getGroup));
router.post("/:groupId/members", requireGroupMember, asyncHandler(groupController.addMember));
router.delete("/:groupId/members/:userId", requireGroupMember, asyncHandler(groupController.removeMember));

export default router;
