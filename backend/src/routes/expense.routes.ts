import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireGroupMember } from "../middleware/auth";
import { requireExpenseGroupMember } from "../middleware/expenseAccess";
import * as expenseController from "../controllers/expense.controller";

// Nested under /api/groups/:groupId/expenses
export const groupExpenseRouter = Router({ mergeParams: true });
groupExpenseRouter.use(requireAuth);
groupExpenseRouter.post("/", requireGroupMember, asyncHandler(expenseController.createExpense));
groupExpenseRouter.get("/", requireGroupMember, asyncHandler(expenseController.listExpenses));

// Standalone /api/expenses/:expenseId
export const expenseRouter = Router();
expenseRouter.use(requireAuth);
expenseRouter.get("/:expenseId", requireExpenseGroupMember, asyncHandler(expenseController.getExpense));
expenseRouter.put("/:expenseId", requireExpenseGroupMember, asyncHandler(expenseController.updateExpense));
expenseRouter.delete("/:expenseId", requireExpenseGroupMember, asyncHandler(expenseController.deleteExpense));
