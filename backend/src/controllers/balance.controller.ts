import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { getGroupBalances, simplifyDebts } from "../services/balance.service";
import { toDecimalString } from "../utils/money";

export async function getBalances(req: AuthedRequest, res: Response) {
  const balances = await getGroupBalances(req.params.groupId);
  const simplified = simplifyDebts(balances);

  res.status(200).json({
    success: true,
    data: {
      balances: balances.map((b) => ({
        userId: b.userId,
        username: b.username,
        netBalance: toDecimalString(b.netBalanceCents),
      })),
      simplifiedDebts: simplified.map((d) => ({
        fromUserId: d.fromUserId,
        fromUsername: d.fromUsername,
        toUserId: d.toUserId,
        toUsername: d.toUsername,
        amount: toDecimalString(d.amountCents),
      })),
    },
  });
}
