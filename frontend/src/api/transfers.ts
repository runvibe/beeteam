import { type LocalizedMessage, LocalizedError, message } from "@/i18n";
import { transferErrorMessage } from "@/i18n/transfer-errors";

import { runtimeConfig } from "../runtime";
export class TransferError extends LocalizedError {
  activeJobId?: string;
  constructor(message: string | LocalizedMessage, activeJobId?: unknown) {
    super(
      typeof message === "string" ? transferErrorMessage(message) : message,
    );
    if (typeof activeJobId === "string") this.activeJobId = activeJobId;
  }
}
export type Preview = {
  manifest: {
    sourceDriver: string;
    snapshotAt: string;
    entries: Record<string, { rows: number | null; bytes: number }>;
  };
  archiveSha256: string;
  destinationId: string;
  destinationDriver: string;
  destinationEmpty: boolean;
  precisionChanges: number;
  confirmationToken: string;
  expiresAt: string;
  warnings: string[];
};
export type TransferJob = {
  id: string;
  kind: string;
  state: string;
  stage: string;
  records: number;
  bytes: number;
  error: string | null;
  preview: Preview | null;
};
export type TransferInfo = {
  enabled: boolean;
  limits?: {
    compressed: number;
    expanded: number;
    entries: number;
    line: number;
    seconds: number;
  };
  retentionSeconds?: number;
};
export const transferBase = () =>
  `${runtimeConfig.apiBaseUrl.replace(/\/$/, "")}/data-transfers`;
export async function transferRequest<T>(
  path: string,
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(transferBase() + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "Idempotency-Key": key ?? crypto.randomUUID(),
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new TransferError(
      data.code ?? `HTTP ${response.status}`,
      data.details?.activeJobId,
    );
  return data;
}
export function uploadArchive(
  file: File,
  hash: string,
  key: string,
  progress: (n: number) => void,
  signal: AbortSignal,
): Promise<TransferJob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", transferBase() + "/imports");
    xhr.setRequestHeader("Idempotency-Key", key);
    xhr.setRequestHeader("X-Archive-SHA256", hash);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.onerror = () =>
      reject(
        new LocalizedError(
          message("errors.connectionFailedDuringUploadTryAgainWithTheSameFile"),
        ),
      );
    xhr.onabort = () =>
      reject(new LocalizedError(message("errors.uploadCancelled")));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400)
          reject(
            new TransferError(
              data.code ?? "upload_failed",
              data.details?.activeJobId,
            ),
          );
        else resolve(data);
      } catch {
        reject(new LocalizedError(message("errors.invalidResponse")));
      }
    };
    const body = new FormData();
    body.append("file", file);
    if (signal.aborted) {
      reject(new LocalizedError(message("errors.uploadCancelled")));
      return;
    }
    xhr.send(body);
  });
}
