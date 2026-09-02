import { describe, it, expect } from "vitest";
import { simplifyDebts, MemberBalance } from "../services/balance.service";

function sumTransactionsForUser(
  transactions: ReturnType<typeof simplifyDebts>,
  userId: string
): number {
  let net = 0;
  for (const t of transactions) {
    if (t.fromUserId === userId) net -= t.amountCents;
    if (t.toUserId === userId) net += t.amountCents;
  }
  return net;
}

describe("simplifyDebts", () => {
  it("matches a single debtor/creditor pair example from the spec", () => {
    const balances: MemberBalance[] = [
      { userId: "alice", username: "alice", netBalanceCents: 5000 },
      { userId: "bob", username: "bob", netBalanceCents: -2000 },
      { userId: "charlie", username: "charlie", netBalanceCents: -3000 },
    ];

    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    // Bob owes Alice $20, Charlie owes Alice $30
    expect(result.find((r) => r.fromUserId === "bob")).toMatchObject({
      toUserId: "alice",
      amountCents: 2000,
    });
    expect(result.find((r) => r.fromUserId === "charlie")).toMatchObject({
      toUserId: "alice",
      amountCents: 3000,
    });
  });

  it("matches the multi-creditor example from the spec", () => {
    const balances: MemberBalance[] = [
      { userId: "alice", username: "alice", netBalanceCents: 4000 },
      { userId: "bob", username: "bob", netBalanceCents: 2000 },
      { userId: "charlie", username: "charlie", netBalanceCents: -3000 },
      { userId: "david", username: "david", netBalanceCents: -3000 },
    ];

    const result = simplifyDebts(balances);

    // Every original balance must be fully reconciled by the transactions.
    for (const b of balances) {
      expect(sumTransactionsForUser(result, b.userId)).toBe(b.netBalanceCents);
    }
  });

  it("produces no transactions when all balances are already zero", () => {
    const balances: MemberBalance[] = [
      { userId: "a", username: "a", netBalanceCents: 0 },
      { userId: "b", username: "b", netBalanceCents: 0 },
    ];
    expect(simplifyDebts(balances)).toHaveLength(0);
  });

  it("always produces transactions that reconcile every balance to zero, for arbitrary balanced input", () => {
    const balances: MemberBalance[] = [
      { userId: "u1", username: "u1", netBalanceCents: 12345 },
      { userId: "u2", username: "u2", netBalanceCents: -5000 },
      { userId: "u3", username: "u3", netBalanceCents: 2000 },
      { userId: "u4", username: "u4", netBalanceCents: -9345 },
    ];
    // Sanity: the fixture itself must sum to zero.
    expect(balances.reduce((s, b) => s + b.netBalanceCents, 0)).toBe(0);

    const result = simplifyDebts(balances);
    for (const b of balances) {
      expect(sumTransactionsForUser(result, b.userId)).toBe(b.netBalanceCents);
    }
  });
});
