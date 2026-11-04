import { locale, t as tr } from "@/i18n";

export function tokenCount(value: string | null | undefined) {
  return value == null
    ? tr("usage.notProvided2")
    : BigInt(value).toLocaleString(locale());
}
