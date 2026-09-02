import { z } from "zod";

const moneyString = z
  .union([z.string(), z.number()])
  .refine(
    (v) => /^-?\d+(\.\d{1,2})?$/.test(typeof v === "number" ? v.toString() : v.trim()),
    "Must be a valid monetary amount (up to 2 decimal places)."
  );

const exactSplitEntry = z.object({
  userId: z.string().uuid(),
  amount: moneyString,
});

export const createExpenseSchema = z
  .object({
    description: z.string().min(1, "Description is required.").max(255),
    totalAmount: moneyString,
    paidByUserId: z.string().uuid("paidByUserId must be a valid user id."),
    date: z.string().datetime().or(z.string().min(1)),
    splitType: z.enum(["EQUAL", "EXACT"]),
    participantUserIds: z
      .array(z.string().uuid())
      .min(1, "At least one participant is required.")
      .optional(),
    exactSplits: z.array(exactSplitEntry).optional(),
  })
  .refine(
    (data) => data.splitType !== "EQUAL" || (data.participantUserIds && data.participantUserIds.length > 0),
    { message: "participantUserIds is required for EQUAL splits.", path: ["participantUserIds"] }
  )
  .refine(
    (data) => data.splitType !== "EXACT" || (data.exactSplits && data.exactSplits.length > 0),
    { message: "exactSplits is required for EXACT splits.", path: ["exactSplits"] }
  );

export const updateExpenseSchema = createExpenseSchema;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
