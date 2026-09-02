import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { getDashboard } from "../services/dashboard.service";
import { toDecimalString } from "../utils/money";

export async function dashboard(req: AuthedRequest, res: Response) {
  const data = await getDashboard(req.userId!);
  res.status(200).json({
    success: true,
    data: {
      groups: data.groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        yourBalance: toDecimalString(g.yourBalanceCents),
      })),
      summary: {
        totalOwedToUser: toDecimalString(data.summary.totalOwedToUserCents),
        totalUserOwes: toDecimalString(data.summary.totalUserOwesCents),
      },
      recentActivity: data.recentActivity.map((a) => ({
        ...a,
        amount: toDecimalString(a.amountCents),
      })),
    },
  });
}
