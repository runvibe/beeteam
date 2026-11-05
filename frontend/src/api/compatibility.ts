import { useQuery } from "@tanstack/react-query";
import { useApi } from "./context";
import { ApiError } from "./types";
import { parseApiInfo, supportsFrontendContract } from "./api-info";
export { parseApiInfo } from "./api-info";

export const apiInfoKey = ["api-info"] as const;
export type CompatibilityStatus =
  "checking" | "compatible" | "incompatible" | "legacy" | "error";
export function useApiCompatibility() {
  const api = useApi();
  const query = useQuery({
    queryKey: apiInfoKey,
    queryFn: async ({ signal }) => parseApiInfo(await api.info(signal)),
    retry: false,
    staleTime: Infinity,
  });
  const info = query.data;
  const contractSupported = supportsFrontendContract(info);
  const status: CompatibilityStatus = query.error
    ? query.error instanceof ApiError && query.error.status === 404
      ? "legacy"
      : "error"
    : !info
      ? "checking"
      : contractSupported
        ? "compatible"
        : "incompatible";
  return {
    ...query,
    info,
    status,
    // Retain last verified support during a transient refresh failure.
    supports: (capability: string) =>
      status !== "legacy" &&
      contractSupported &&
      !!info?.capabilities.includes(capability),
  };
}
