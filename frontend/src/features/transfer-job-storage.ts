const storageKey = "bee-transfer-job";
/** Persistence is optional; the active job still lives in component state. */
export function readTransferJob(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}
export function persistTransferJob(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, id);
  } catch {
    /* Storage may be denied or full; retain the session's job state. */
  }
}
