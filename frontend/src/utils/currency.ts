/** Format a decimal-string amount (e.g. "25.00") as USD currency for display. */
export function formatCurrency(decimalString: string): string {
  const value = parseFloat(decimalString);
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** True if the decimal-string amount is positive (owed TO the user). */
export function isPositive(decimalString: string): boolean {
  return parseFloat(decimalString) > 0;
}

/** True if the decimal-string amount is negative (owed BY the user). */
export function isNegative(decimalString: string): boolean {
  return parseFloat(decimalString) < 0;
}

export function absAmount(decimalString: string): string {
  return Math.abs(parseFloat(decimalString)).toFixed(2);
}
