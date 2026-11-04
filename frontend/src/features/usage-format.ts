import { locale, t as tr } from "@/i18n";

export function tokenCount(value: string | null | undefined) {
  return value == null
    ? tr("usage.notProvided2")
    : BigInt(value).toLocaleString(locale());
}

/** Format the exact amount; use only a small representative for grammatical selection. */
export function tokenAmount(value: string | null | undefined) {
  if (value == null) return tr("usage.notProvided2");
  const amount = BigInt(value);
  const count = amount === 0n ? 0 : amount === 1n ? 1 : 2;
  return tr("usage.tokenAmount", {
    count,
    amount: amount.toLocaleString(locale()),
  });
}
