import { locale, t as tr } from "@/i18n";

/** Formats an observed millisecond count, never wall-clock time since an open boundary. */
export function observedDuration(value: string | number | null | undefined) {
  if (value == null) return tr("usage.notProvided");
  const total = BigInt(value);
  const parts: string[] = [];
  for (const [unit, divisor] of [
    ["h", 3600000n],
    ["min", 60000n],
    ["s", 1000n],
    ["ms", 1n],
  ] as const) {
    const amount =
      unit === "h"
        ? total / divisor
        : (total / divisor) % (unit === "ms" ? 1000n : 60n);
    if (amount !== 0n) parts.push(`${amount.toLocaleString(locale())} ${unit}`);
  }
  return parts.join(" ") || tr("usage.0Ms");
}
