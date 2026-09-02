import { formatCurrency, isPositive, isNegative, absAmount } from "../utils/currency";

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">{message}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

/** Shows "you owe $X" in red or "you are owed $X" in green, or "settled up" in gray. */
export function BalancePill({ amount }: { amount: string }) {
  if (isPositive(amount)) {
    return (
      <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
        you are owed {formatCurrency(absAmount(amount))}
      </span>
    );
  }
  if (isNegative(amount)) {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
        you owe {formatCurrency(absAmount(amount))}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
      settled up
    </span>
  );
}
