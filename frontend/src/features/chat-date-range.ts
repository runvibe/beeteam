import { validDate } from "@/routing/query";
/** Calendar days in the browser timezone; advancing the date respects DST. */
function boundary(value: string, nextDay = false) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day + (nextDay ? 1 : 0));
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
export function chatDateRange(from: string, until: string) {
  const valid =
    validDate(from) && validDate(until) && (!from || !until || from <= until);
  return {
    valid,
    createdFrom: valid ? boundary(from) : undefined,
    createdBefore: valid ? boundary(until, true) : undefined,
  };
}
