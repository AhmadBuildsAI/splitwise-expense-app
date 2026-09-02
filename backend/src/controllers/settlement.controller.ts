import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { createSettlementSchema } from "../validators/settlement.validators";
import * as settlementService from "../services/settlement.service";
import { toDecimalString } from "../utils/money";

function serializeSettlement(s: any) {
  return {
    id: s.id,
    groupId: s.groupId,
    paidByUserId: s.paidByUserId,
    paidToUserId: s.paidToUserId,
    amount: toDecimalString(s.amount),
    date: s.date,
  };
}

export async function createSettlement(req: AuthedRequest, res: Response) {
  const input = createSettlementSchema.parse(req.body);
  const settlement = await settlementService.createSettlement(req.params.groupId, req.userId!, input);
  res.status(201).json({ success: true, data: { settlement: serializeSettlement(settlement) } });
}

export async function listSettlements(req: AuthedRequest, res: Response) {
  const settlements = await settlementService.listGroupSettlements(req.params.groupId);
  res.status(200).json({
    success: true,
    data: {
      settlements: settlements.map((s: any) => ({
        ...serializeSettlement(s),
        paidByUsername: s.payer.username,
        paidToUsername: s.payee.username,
      })),
    },
  });
}
