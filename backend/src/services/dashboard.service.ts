import { prisma } from "../lib/prisma";
import { getUserOverallSummary, getUserBalanceInGroup } from "./balance.service";

export async function getDashboard(userId: string) {
  const summary = await getUserOverallSummary(userId);

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
  });

  const groups = await Promise.all(
    memberships.map(async (m: any) => ({
      id: m.group.id,
      name: m.group.name,
      memberCount: m.group._count.members,
      yourBalanceCents: await getUserBalanceInGroup(m.groupId, userId),
    }))
  );

  const groupIds = memberships.map((m: any) => m.groupId);

  const [recentExpenses, recentSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      include: { payer: { select: { username: true } }, group: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        payer: { select: { username: true } },
        payee: { select: { username: true } },
        group: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const recentActivity = [
    ...recentExpenses.map((e: any) => ({
      type: "EXPENSE" as const,
      id: e.id,
      groupName: e.group.name,
      description: e.description,
      paidBy: e.payer.username,
      amountCents: e.totalAmount,
      date: e.date,
    })),
    ...recentSettlements.map((s: any) => ({
      type: "SETTLEMENT" as const,
      id: s.id,
      groupName: s.group.name,
      description: `${s.payer.username} paid ${s.payee.username}`,
      paidBy: s.payer.username,
      amountCents: s.amount,
      date: s.date,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return {
    groups,
    summary: {
      totalOwedToUserCents: summary.totalOwedToUserCents,
      totalUserOwesCents: summary.totalUserOwesCents,
    },
    recentActivity,
  };
}
