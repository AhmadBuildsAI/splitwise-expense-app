import { z } from "zod";

const moneyString = z
  .union([z.string(), z.number()])
  .refine(
    (v) => /^-?\d+(\.\d{1,2})?$/.test(typeof v === "number" ? v.toString() : v.trim()),
    "Must be a valid monetary amount (up to 2 decimal places)."
  );

export const createSettlementSchema = z.object({
  paidByUserId: z.string().uuid(),
  paidToUserId: z.string().uuid(),
  amount: moneyString,
  date: z.string().datetime().or(z.string().min(1)),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
