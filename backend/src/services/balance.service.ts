/**
 * Balance calculation engine.
 *
 * SOURCE OF TRUTH: Expenses + ExpenseSplits + Settlements.
 * Balances are NEVER stored — they are always derived from these
 * records, so edits/deletes to expenses and settlements automatically
 * keep balances correct with zero risk of drift.
 *
 * Net balance for user U in a group:
 *   sum(expense.totalAmount where U is payer)
 *   - sum(split.amountOwed where U is the split's user, for
 *         non-deleted expenses)
 *   + sum(settlement.amount where U is paidTo)   [U received money]
 *   - sum(settlement.amount where U is paidBy)   [U paid money]
 *
 * A positive net balance means the group owes that user money.
 * A negative net balance means that user owes the group money.
 */

import { prisma } from "../lib/prisma";

export interface MemberBalance {
  userId: string;
  username: string;
  netBalanceCents: number;
}

export interface SimplifiedDebt {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amountCents: number;
}

/**
 * Compute the net balance (in cents) for every member of a group.
 */
export async function getGroupBalances(
  groupId: string
): Promise<MemberBalance[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const balances = new Map<string, number>();
  for (const m of members) balances.set(m.userId, 0);

  // 1. Expenses: payer is credited the full total; every split
  //    participant (which may include the payer) is debited their share.
  const expenses = await prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    include: { splits: true },
  });

  for (const expense of expenses) {
    balances.set(
      expense.paidByUserId,
      (balances.get(expense.paidByUserId) ?? 0) + expense.totalAmount
    );
    for (const split of expense.splits) {
      balances.set(
        split.userId,
        (balances.get(split.userId) ?? 0) - split.amountOwed
      );
    }
  }

  // 2. Settlements: the payer's debt decreases (balance increases
  //    towards zero... but modeled directly): paying money increases
  //    your net balance (you've discharged an obligation or now the
  //    group owes you less / more, depending on sign) and the payee's
  //    balance decreases by the same amount, because they've now been
  //    paid what was owed to them.
  const settlements = await prisma.settlement.findMany({ where: { groupId } });
  for (const s of settlements) {
    balances.set(s.paidByUserId, (balances.get(s.paidByUserId) ?? 0) + s.amount);
    balances.set(s.paidToUserId, (balances.get(s.paidToUserId) ?? 0) - s.amount);
  }

  const result: MemberBalance[] = members.map((m: any) => ({
    userId: m.userId,
    username: m.user.username,
    netBalanceCents: balances.get(m.userId) ?? 0,
  }));

  // Sanity invariant: net balances across the group must always sum to
  // zero (every expense's total is fully allocated across splits, and
  // every settlement transfers between two members within the group).
  const sum = result.reduce((acc, r) => acc + r.netBalanceCents, 0);
  if (sum !== 0) {
    // This should never happen if invariants elsewhere hold; surfacing
    // it loudly is preferable to silently returning wrong numbers.
    // eslint-disable-next-line no-console
    console.error(
      `Balance invariant violated for group ${groupId}: sum=${sum}`
    );
  }

  return result;
}

/**
 * Get a single user's net balance within a group (in cents).
 */
export async function getUserBalanceInGroup(
  groupId: string,
  userId: string
): Promise<number> {
  const balances = await getGroupBalances(groupId);
  return balances.find((b) => b.userId === userId)?.netBalanceCents ?? 0;
}

/**
 * Deterministic debt-simplification algorithm.
 *
 * Given net balances, produce the minimal-ish set of "A owes B $X"
 * transactions such that settling them all zeroes out every balance.
 *
 * Algorithm (greedy largest-creditor / largest-debtor matching):
 *   1. Split members into creditors (balance > 0) and debtors (balance < 0).
 *   2. Sort each descending by magnitude (deterministic tie-break by userId).
 *   3. Repeatedly match the largest debtor against the largest creditor:
 *      transfer min(|debt|, credit) from debtor to creditor, and reduce
 *      both by that amount. Whichever hits zero first is removed/re-sorted.
 *   4. Repeat until all balances are zero.
 *
 * This is a well-known heuristic (not guaranteed minimum-transaction-count
 * in all cases, but always correct and deterministic) that matches the
 * examples in the spec.
 */
export function simplifyDebts(
  balances: MemberBalance[]
): SimplifiedDebt[] {
  type Node = { userId: string; username: string; amount: number };

  const creditors: Node[] = balances
    .filter((b) => b.netBalanceCents > 0)
    .map((b) => ({ userId: b.userId, username: b.username, amount: b.netBalanceCents }));

  const debtors: Node[] = balances
    .filter((b) => b.netBalanceCents < 0)
    .map((b) => ({ userId: b.userId, username: b.username, amount: -b.netBalanceCents }));

  const sortDesc = (a: Node, b: Node) =>
    b.amount - a.amount || a.userId.localeCompare(b.userId);

  creditors.sort(sortDesc);
  debtors.sort(sortDesc);

  const transactions: SimplifiedDebt[] = [];

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amountCents: amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return transactions;
}

/**
 * Convenience: get simplified "who owes whom" list directly for a group.
 */
export async function getSimplifiedGroupDebts(
  groupId: string
): Promise<SimplifiedDebt[]> {
  const balances = await getGroupBalances(groupId);
  return simplifyDebts(balances);
}

/**
 * Total amounts a user owes / is owed, aggregated across ALL of their groups.
 */
export async function getUserOverallSummary(userId: string): Promise<{
  totalOwedToUserCents: number;
  totalUserOwesCents: number;
  perGroup: { groupId: string; groupName: string; netBalanceCents: number }[];
}> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
  });

  let totalOwedToUserCents = 0;
  let totalUserOwesCents = 0;
  const perGroup: { groupId: string; groupName: string; netBalanceCents: number }[] = [];

  for (const m of memberships) {
    const net = await getUserBalanceInGroup(m.groupId, userId);
    perGroup.push({ groupId: m.groupId, groupName: m.group.name, netBalanceCents: net });
    if (net > 0) totalOwedToUserCents += net;
    if (net < 0) totalUserOwesCents += -net;
  }

  return { totalOwedToUserCents, totalUserOwesCents, perGroup };
}
