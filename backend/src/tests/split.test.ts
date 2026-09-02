import { describe, it, expect } from "vitest";
import { splitEqual, toCents } from "../utils/money";

/**
 * These tests exercise the same balance arithmetic used by
 * balance.service.getGroupBalances, but against an in-memory ledger
 * instead of the database, so they can run without a live Postgres
 * instance (useful in CI / sandboxed environments). The full
 * DB-backed integration tests live alongside this file and require
 * DATABASE_URL to be set (see README "Running tests").
 */
interface Expense {
  totalAmount: number;
  paidByUserId: string;
  splits: { userId: string; amountOwed: number }[];
}
interface Settlement {
  paidByUserId: string;
  paidToUserId: string;
  amount: number;
}

function computeBalances(
  members: string[],
  expenses: Expense[],
  settlements: Settlement[]
): Record<string, number> {
  const balances: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of expenses) {
    balances[e.paidByUserId] += e.totalAmount;
    for (const s of e.splits) balances[s.userId] -= s.amountOwed;
  }
  for (const s of settlements) {
    balances[s.paidByUserId] += s.amount;
    balances[s.paidToUserId] -= s.amount;
  }
  return balances;
}

describe("payer included in participants", () => {
  it("nets the payer's own share against what they paid", () => {
    // $100 expense, Alice pays, split equally among Alice, Bob, Charlie, David
    const splits = splitEqual(toCents("100"), ["alice", "bob", "charlie", "david"]);
    const balances = computeBalances(
      ["alice", "bob", "charlie", "david"],
      [{ totalAmount: toCents("100"), paidByUserId: "alice", splits }],
      []
    );
    // Alice paid 10000, owes 2500 -> net +7500
    expect(balances.alice).toBe(7500);
    expect(balances.bob).toBe(-2500);
    expect(balances.charlie).toBe(-2500);
    expect(balances.david).toBe(-2500);
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("payer not included in participants", () => {
  it("credits the payer fully since they owe none of the split", () => {
    // Alice pays $60 for Bob and Charlie only (Alice is not a participant)
    const splits = splitEqual(toCents("60"), ["bob", "charlie"]);
    const balances = computeBalances(
      ["alice", "bob", "charlie"],
      [{ totalAmount: toCents("60"), paidByUserId: "alice", splits }],
      []
    );
    expect(balances.alice).toBe(6000);
    expect(balances.bob).toBe(-3000);
    expect(balances.charlie).toBe(-3000);
  });
});

describe("multiple expenses", () => {
  it("accumulates net balances correctly across several expenses", () => {
    const e1Splits = splitEqual(toCents("30"), ["alice", "bob"]);
    const e2Splits = splitEqual(toCents("50"), ["alice", "bob", "charlie"]);

    const balances = computeBalances(
      ["alice", "bob", "charlie"],
      [
        { totalAmount: toCents("30"), paidByUserId: "alice", splits: e1Splits },
        { totalAmount: toCents("50"), paidByUserId: "bob", splits: e2Splits },
      ],
      []
    );

    // Expense 1: alice +3000 -1500=+1500, bob -1500
    // Expense 2 ($50/3 = 1667,1667,1666): bob +5000, alice -1667, bob -1667, charlie -1666
    expect(balances.alice).toBe(1500 - 1667);
    expect(balances.bob).toBe(-1500 + 5000 - 1667);
    expect(balances.charlie).toBe(-1666);
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("settlement calculations", () => {
  it("a settlement reduces the payer's debt and the payee's credit symmetrically", () => {
    const splits = splitEqual(toCents("100"), ["alice", "bob"]);
    const balances = computeBalances(
      ["alice", "bob"],
      [{ totalAmount: toCents("100"), paidByUserId: "alice", splits }],
      [{ paidByUserId: "bob", paidToUserId: "alice", amount: toCents("50") }]
    );
    // Before settlement: alice +5000, bob -5000
    // After bob pays alice 5000: alice 5000-5000=0, bob -5000+5000=0
    expect(balances.alice).toBe(0);
    expect(balances.bob).toBe(0);
  });
});
