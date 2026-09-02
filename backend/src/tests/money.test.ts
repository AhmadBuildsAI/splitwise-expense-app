import { describe, it, expect } from "vitest";
import { toCents, toDecimalString, splitEqual, validateExactSplit } from "../utils/money";

describe("toCents", () => {
  it("converts whole dollar amounts", () => {
    expect(toCents("100")).toBe(10000);
    expect(toCents(100)).toBe(10000);
  });

  it("converts decimal amounts without floating point drift", () => {
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("0.1")).toBe(10);
    expect(toCents(19.99)).toBe(1999);
  });

  it("rejects invalid formats", () => {
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents("1.999")).toThrow();
  });
});

describe("toDecimalString", () => {
  it("formats cents back to decimal strings", () => {
    expect(toDecimalString(10050)).toBe("100.50");
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(0)).toBe("0.00");
  });
});

describe("splitEqual", () => {
  it("splits evenly divisible totals equally", () => {
    const result = splitEqual(10000, ["a", "b", "c", "d"]);
    expect(result.every((r) => r.amountOwed === 2500)).toBe(true);
    const sum = result.reduce((acc, r) => acc + r.amountOwed, 0);
    expect(sum).toBe(10000);
  });

  it("distributes remainder cents deterministically so the sum always matches exactly (10000 / 3)", () => {
    const result = splitEqual(10000, ["a", "b", "c"]);
    const sum = result.reduce((acc, r) => acc + r.amountOwed, 0);
    expect(sum).toBe(10000);
    // 10000 / 3 = 3333.33..., base share 3333, remainder 1 cent to first participant
    expect(result[0].amountOwed).toBe(3334);
    expect(result[1].amountOwed).toBe(3333);
    expect(result[2].amountOwed).toBe(3333);
  });

  it("handles a case with a larger remainder (10001 cents among 4 people)", () => {
    const result = splitEqual(10001, ["a", "b", "c", "d"]);
    const sum = result.reduce((acc, r) => acc + r.amountOwed, 0);
    expect(sum).toBe(10001);
    // base = 2500, remainder = 1 -> first participant gets 2501
    expect(result.map((r) => r.amountOwed)).toEqual([2501, 2500, 2500, 2500]);
  });

  it("throws for zero participants", () => {
    expect(() => splitEqual(1000, [])).toThrow();
  });

  it("throws for non-positive totals", () => {
    expect(() => splitEqual(0, ["a"])).toThrow();
    expect(() => splitEqual(-500, ["a"])).toThrow();
  });
});

describe("validateExactSplit", () => {
  it("passes when splits sum exactly to the total", () => {
    expect(() =>
      validateExactSplit(10000, [
        { userId: "a", amountOwed: 2000 },
        { userId: "b", amountOwed: 3000 },
        { userId: "c", amountOwed: 5000 },
      ])
    ).not.toThrow();
  });

  it("rejects when splits do not sum to the total", () => {
    expect(() =>
      validateExactSplit(10000, [
        { userId: "a", amountOwed: 2000 },
        { userId: "b", amountOwed: 3000 },
      ])
    ).toThrow(/must equal the total expense/);
  });

  it("rejects duplicate participants", () => {
    expect(() =>
      validateExactSplit(10000, [
        { userId: "a", amountOwed: 5000 },
        { userId: "a", amountOwed: 5000 },
      ])
    ).toThrow(/Duplicate participant/);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      validateExactSplit(10000, [
        { userId: "a", amountOwed: 0 },
        { userId: "b", amountOwed: 10000 },
      ])
    ).toThrow();
  });
});
