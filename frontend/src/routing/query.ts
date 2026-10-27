import { currentUrl, navigate, useLocation } from "./location";
type Options = {
  resetOffsets?: boolean;
  values?: readonly string[];
  validate?: (value: string) => boolean;
};
/** URL is canonical. Setters read latest URL so batched changes compose. */
export function useUrlState<T extends string | number>(
  key: string,
  initial: T,
  options: Options = {},
): [T, (value: T) => void] {
  const url = useLocation();
  const raw = new URLSearchParams(url.split("?")[1]).get(key);
  let value: string | number = initial;
  if (raw !== null) {
    if (typeof initial === "number") {
      const n = Number(raw);
      if (
        /^\d+$/.test(raw) &&
        Number.isSafeInteger(n) &&
        n >= (key.endsWith("limit") ? 1 : 0) &&
        n <= (key.endsWith("limit") ? 100 : 1000000)
      )
        value = n;
    } else if (
      (!/(teamId|executor)$/.test(key) ||
        raw === "" ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          raw,
        )) &&
      (!options.values || options.values.includes(raw)) &&
      (!options.validate || options.validate(raw))
    )
      value = raw;
  }
  return [
    value as T,
    (next: T) => {
      const [path, query] = currentUrl().split("?");
      const latest = new URLSearchParams(query);
      if (next === initial) latest.delete(key);
      else latest.set(key, String(next));
      if (
        options.resetOffsets !== false &&
        !key.endsWith("offset") &&
        !key.endsWith("tab") &&
        !key.endsWith("show")
      ) {
        const scope = key.slice(0, key.lastIndexOf("."));
        for (const k of [...latest.keys()])
          if (k.startsWith(scope + ".") && k.endsWith("offset"))
            latest.delete(k);
      }
      navigate(path + (latest.size ? `?${latest}` : ""));
    },
  ];
}
export function usePageSize(scope: string, fallback: number) {
  return useUrlState(`${scope}.limit`, fallback)[0];
}
export const booleanValues = ["", "false", "true"];
export const validDate = (value: string) =>
  value === "" ||
  (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);
