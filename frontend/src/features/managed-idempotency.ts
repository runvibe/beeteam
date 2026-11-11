import { ApiError } from "@/api/types";

export function isDefinitiveManagedFailure(
  error: unknown,
  hadUncertainAttempt: boolean,
) {
  // A rejected retry cannot disprove that the earlier attempt committed.
  return (
    !hadUncertainAttempt &&
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  );
}
