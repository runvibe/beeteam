import type { ApiInfo } from "./generated/system/ApiInfo";
import { ApiError } from "./types";
import { message } from "@/i18n";
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
export function parseApiInfo(value: unknown): ApiInfo {
  const info = value as Partial<ApiInfo> | null;
  if (
    !info ||
    typeof info !== "object" ||
    typeof info.apiVersion !== "string" ||
    !info.apiVersion.trim() ||
    !stringArray(info.supportedContractVersions) ||
    !stringArray(info.capabilities)
  )
    throw new ApiError(
      200,
      "invalid_response",
      message("errors.theApiReturnedAnInvalidResponse"),
    );
  return info as ApiInfo;
}
export const supportsWorkerContract = (info?: ApiInfo) =>
  !!info?.supportedContractVersions.includes("v2") &&
  info.capabilities.includes("roles.worker");
export const supportsFrontendContract = (info?: ApiInfo) =>
  !!info?.supportedContractVersions.includes("v1") ||
  supportsWorkerContract(info);
