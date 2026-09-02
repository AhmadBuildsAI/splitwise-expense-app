/**
 * Money utilities.
 *
 * RULE: money is ALWAYS represented as an integer number of cents
 * everywhere in the backend (database, service layer, business logic).
 * JavaScript floating point numbers are NEVER used for arithmetic on
 * money. Decimal strings from the API/UI are converted to integer
 * cents at the boundary using `toCents`, and converted back only for
 * display/serialization using `toDecimalString`.
 */

import { AppError } from "./AppError";

/**
 * Convert a decimal currency value (e.g. from client JSON, as a number
 * or numeric string like "100.50" or 100.5) into integer cents (10050).
 *
 * We parse the string representation directly (rather than doing
 * float math like `value * 100`) to avoid binary floating point
 * artifacts such as 19.99 * 100 === 1998.9999999999998.
 */
export function toCents(value: number | string): number {
  const str = typeof value === "number" ? value.toString() : value.trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    throw new AppError(400, `Invalid monetary amount: "${value}"`);
  }

  const negative = str.startsWith("-");
  const unsigned = negative ? str.slice(1) : str;
  const [wholePart, fracPartRaw = ""] = unsigned.split(".");
  const fracPart = (fracPartRaw + "00").slice(0, 2);

  const cents = parseInt(wholePart, 10) * 100 + parseInt(fracPart, 10);
  return negative ? -cents : cents;
}

/** Convert integer cents back into a fixed 2-decimal-place string, e.g. 10050 -> "100.50" */
export function toDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const wholePart = Math.floor(abs / 100);
  const fracPart = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${wholePart}.${fracPart}`;
}

/**
 * Split `totalCents` equally among `participantUserIds`, guaranteeing:
 *   1. Every participant gets an integer number of cents.
 *   2. sum(shares) === totalCents exactly (no rounding drift).
 *
 * Approach: integer-divide to get a base share for everyone, then
 * distribute the remainder cents one-by-one, deterministically, to
 * the first N participants in the given (stable) order. This is the
 * standard "largest remainder"-free deterministic distribution used
 * by real bill-splitting systems.
 */
export function splitEqual(
  totalCents: number,
  participantUserIds: string[]
): { userId: string; amountOwed: number }[] {
  if (participantUserIds.length === 0) {
    throw new AppError(400, "An expense must have at least one participant.");
  }
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new AppError(400, "Expense total must be a positive amount.");
  }

  const n = participantUserIds.length;
  const baseShare = Math.floor(totalCents / n);
  const remainder = totalCents - baseShare * n;

  return participantUserIds.map((userId, index) => ({
    userId,
    // The first `remainder` participants (in stable input order) get
    // one extra cent each so the total reconciles exactly.
    amountOwed: baseShare + (index < remainder ? 1 : 0),
  }));
}

/**
 * Validate an exact split: every amount must be a positive integer
 * number of cents, one entry per distinct user, and the sum must
 * exactly equal totalCents.
 */
export function validateExactSplit(
  totalCents: number,
  splits: { userId: string; amountOwed: number }[]
): void {
  if (splits.length === 0) {
    throw new AppError(400, "An expense must have at least one participant.");
  }

  const seen = new Set<string>();
  let sum = 0;
  for (const s of splits) {
    if (seen.has(s.userId)) {
      throw new AppError(400, `Duplicate participant in split: ${s.userId}`);
    }
    seen.add(s.userId);

    if (!Number.isInteger(s.amountOwed) || s.amountOwed <= 0) {
      throw new AppError(
        400,
        "Each exact split amount must be a positive number."
      );
    }
    sum += s.amountOwed;
  }

  if (sum !== totalCents) {
    throw new AppError(
      400,
      `The split amounts (${toDecimalString(
        sum
      )}) must equal the total expense (${toDecimalString(totalCents)}).`
    );
  }
}
