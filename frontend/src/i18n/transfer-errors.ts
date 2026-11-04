import { message } from "./index";
const errorKeys: Record<string, string> = {
  transfer_disabled: "transfer.error.disabled",
  upload_failed: "transfer.error.uploadFailed",
  upload_interrupted: "transfer.error.interrupted",
  process_interrupted: "transfer.error.interrupted",
  invalid_archive_hash: "transfer.error.invalidHash",
  archive_hash_mismatch: "transfer.error.invalidHash",
  import_not_ready: "transfer.error.notReady",
  export_not_ready: "transfer.error.notReady",
  confirmation_mismatch: "transfer.error.confirmation",
  preview_expired: "transfer.error.previewExpired",
  destination_not_empty: "transfer.error.destinationNotEmpty",
  timestamp_precision_loss: "transfer.error.precisionLoss",
  transfer_failed: "transfer.transferFailed",
  transfer_cancelled: "errors.uploadCancelled",
};
export const transferErrorMessage = (value: string) =>
  errorKeys[value] ? message(errorKeys[value]) : value;
