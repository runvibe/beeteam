import { CookiePreferences } from "@/analytics/consent-controls";
import { readTransferJob, persistTransferJob } from "./transfer-job-storage";
import {
  formatNumber,
  formatPercent,
  useLocale,
  t as tr,
  LocalizedError,
  message,
} from "@/i18n";
import { AppearanceSettings } from "@/components/appearance-settings";
import { ApiCompatibilityDetails } from "@/components/api-compatibility";
import { LanguageControl } from "@/components/language-control";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  transferBase,
  TransferError,
  transferRequest,
  uploadArchive,
  type TransferInfo,
  type TransferJob,
} from "@/api/transfers";
import { hashFile } from "@/api/file-hash";

import {
  transferBusy,
  transferState,
  transferStage,
  transferErrorText,
} from "./transfer-labels";
const ongoing = (state: string) =>
  ["running", "restoring", "queued"].includes(state);
export function DataTransferSettings() {
  useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="filter-icon"
              aria-label={tr("transfer.globalSettings")}
              onClick={() => setOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
              {tr("transfer.globalSettings")}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>{tr("transfer.globalSettings")}</DialogTitle>
            <DialogDescription>
              {tr("settings.globalSettingsHelp")}
            </DialogDescription>
          </DialogHeader>
          <AppearanceSettings />
          <LanguageControl />
          <CookiePreferences />
          <ApiCompatibilityDetails />
          <section className="detail-section">
            <h3>{tr("transfer.exportAndImportData")}</h3>
            <p className="small-note">
              {tr(
                "transfer.portableArchiveOfThisBeeTeamInstallationImportRequiresAn",
              )}
            </p>
            <DataTransferPanel />
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function DataTransferPanel() {
  useLocale();
  const client = useQueryClient();
  const [jobId, setJobId] = useState(readTransferJob);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState("");
  const [percent, setPercent] = useState(0);
  const [confirmed, setConfirmed] = useState(false),
    [truncate, setTruncate] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const actionKeys = useRef(new Map<string, string>());
  const key = (name: string) => {
    if (!actionKeys.current.has(name))
      actionKeys.current.set(name, crypto.randomUUID());
    return actionKeys.current.get(name)!;
  };
  const info = useQuery({
    queryKey: ["transfer-info"],
    queryFn: () => transferRequest<TransferInfo>(""),
    retry: false,
  });
  const job = useQuery({
    queryKey: ["transfer-job", jobId],
    queryFn: () => transferRequest<TransferJob>(`/jobs/${jobId}`),
    enabled: !!jobId && !!info.data?.enabled,
    refetchInterval: (q) =>
      ongoing(q.state.data?.state ?? "running") ? 1000 : false,
    retry: 2,
  });
  const remember = (value: TransferJob) => {
    setJobId(value.id);
    persistTransferJob(value.id);
    client.setQueryData(["transfer-job", value.id], value);
    setConfirmed(false);
    setTruncate(false);
  };
  useEffect(() => {
    if (job.data?.state === "completed") {
      void client
        .cancelQueries({
          predicate: (q) => !String(q.queryKey[0]).startsWith("transfer-"),
        })
        .then(() =>
          client.invalidateQueries({
            predicate: (q) => !String(q.queryKey[0]).startsWith("transfer-"),
          }),
        );
    }
  }, [job.data?.state, client]);
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new LocalizedError(message("transfer.transferFailed")),
      );
      if (e instanceof TransferError && e.activeJobId) {
        setJobId(e.activeJobId);
        persistTransferJob(e.activeJobId);
      }
    } finally {
      setBusy("");
    }
  };
  const importFile = (file: File) =>
    void run("preparing", async () => {
      if (file.size > (info.data?.limits?.compressed ?? 0))
        throw new LocalizedError(message("transfer.fileExceedsTheUploadLimit"));
      setPercent(0);
      const hash = await hashFile(file, setPercent);
      setBusy("uploading");
      setPercent(0);
      abort.current = new AbortController();
      remember(
        await uploadArchive(
          file,
          hash,
          key(`upload:${hash}`),
          setPercent,
          abort.current.signal,
        ),
      );
      abort.current = null;
    });
  const active = !!busy || ongoing(job.data?.state ?? "");
  const preview = job.data?.preview;
  if (info.isPending)
    return <p role="status">{tr("transfer.checkingSettings")}</p>;
  if (info.error)
    return (
      <p role="alert">
        {tr("transfer.couldNotReachTheApi")}{" "}
        <Button onClick={() => void info.refetch()}>
          {tr("common.tryAgain")}
        </Button>
      </p>
    );
  if (!info.data?.enabled)
    return (
      <p>
        {tr(
          "transfer.transferIsDisabledOnThisInstallationAnAdministratorCanEnable",
        )}
      </p>
    );
  return (
    <div className="transfer-settings">
      <p>
        {tr(
          "transfer.theArchiveIncludesAttachmentsHistorySoftDeletedRecordsAndIdempotency",
        )}
      </p>
      <p>
        {tr("transfer.limitsDescription", {
          upload: Math.round(info.data.limits!.compressed / 1024 / 1024),
          expanded: Math.round(info.data.limits!.expanded / 1024 / 1024),
          entries: tr("transfer.entryCount", {
            count: info.data.limits!.entries,
          }),
          duration: tr("transfer.minuteCount", {
            count: info.data.limits!.seconds / 60,
          }),
          retention: tr("transfer.hourCount", {
            count: info.data.retentionSeconds! / 3600,
          }),
        })}
      </p>
      <div className="form-actions">
        <Button
          disabled={active}
          onClick={() =>
            void run("exporting", async () =>
              remember(
                await transferRequest<TransferJob>(
                  "/exports",
                  {},
                  key("export"),
                ),
              ),
            )
          }
        >
          {tr("transfer.exportData")}
        </Button>
        <label>
          {tr("transfer.importBeeteamZipArchive")}{" "}
          <input
            aria-label={tr("transfer.importArchive")}
            type="file"
            accept=".zip,.beeteam.zip"
            disabled={active}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy && (
        <div role="status">
          {transferBusy(busy)} {percent > 0 ? formatPercent(percent) : ""}
          {busy === "uploading" && (
            <Button onClick={() => abort.current?.abort()}>
              {tr("transfer.cancelUpload")}
            </Button>
          )}
        </div>
      )}
      {(error || job.error) && (
        <p role="alert">
          {error?.message || job.error?.message}
          <Button onClick={() => void job.refetch()}>
            {tr("transfer.checkAgain")}
          </Button>
        </p>
      )}
      {job.data && (
        <section aria-label={tr("transfer.currentTransfer")}>
          <p role="status">
            {transferState(job.data.state)} · {transferStage(job.data.stage)} ·{" "}
            {tr("transfer.recordCount", { count: job.data.records })}
          </p>
          <small>
            {tr("transfer.job")} {job.data.id}
          </small>
          {job.data.error && (
            <p role="alert">{transferErrorText(job.data.error)}</p>
          )}
          {job.data.kind === "export" && job.data.state === "ready" && (
            <a href={`${transferBase()}/exports/${job.data.id}/file`} download>
              {tr("transfer.downloadBeeteamZip")}
            </a>
          )}
          {ongoing(job.data.state) && (
            <Button
              disabled={!!busy}
              onClick={() =>
                void run("cancelling", async () =>
                  remember(
                    await transferRequest<TransferJob>(
                      `/jobs/${jobId}/cancel`,
                      {},
                      key(`cancel:${jobId}`),
                    ),
                  ),
                )
              }
            >
              {tr("transfer.cancelTransfer")}
            </Button>
          )}
          {preview && job.data.state === "ready" && (
            <div>
              <h3>{tr("transfer.importPreview")}</h3>
              <p>
                {tr("transfer.source")} {preview.manifest.sourceDriver}{" "}
                {tr("transfer.snapshot")} {preview.manifest.snapshotAt}
              </p>
              <p>
                {tr("transfer.destination")} {preview.destinationDriver} ·{" "}
                {preview.destinationEmpty
                  ? tr("transfer.empty")
                  : tr("transfer.containsDataImportBlocked")}
              </p>
              <ul>
                {Object.entries(preview.manifest.entries)
                  .filter(([, entry]) => entry.rows !== null)
                  .map(([name, entry]) => (
                    <li key={name}>
                      {name.replace("records/", "").replace(".jsonl", "")}:{" "}
                      {formatNumber(entry.rows)}
                    </li>
                  ))}
              </ul>
              {!!preview.precisionChanges && (
                <label>
                  <input
                    type="checkbox"
                    checked={truncate}
                    onChange={(e) => setTruncate(e.target.checked)}
                  />{" "}
                  {tr("transfer.truncateApproval", {
                    count: preview.precisionChanges,
                  })}
                </label>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                {tr(
                  "transfer.iConfirmACompleteRestoreToThisEmptyDestinationIncluding",
                )}
              </label>
              <Button
                disabled={
                  active ||
                  !confirmed ||
                  !preview.destinationEmpty ||
                  (preview.precisionChanges > 0 && !truncate)
                }
                onClick={() =>
                  void run("restoring", async () =>
                    remember(
                      await transferRequest<TransferJob>(
                        `/imports/${jobId}/restore`,
                        {
                          confirmationToken: preview.confirmationToken,
                          archiveSha256: preview.archiveSha256,
                          destinationId: preview.destinationId,
                          timestampPolicy: truncate
                            ? "truncate_to_microseconds"
                            : "strict",
                        },
                        key(`restore:${jobId}:${truncate}`),
                      ),
                    ),
                  )
                }
              >
                {tr("transfer.restoreData")}
              </Button>
            </div>
          )}
          {!ongoing(job.data.state) && (
            <Button
              variant="ghost"
              onClick={() => {
                setJobId(null);
                persistTransferJob(null);
                actionKeys.current.clear();
              }}
            >
              {tr("transfer.newTransfer")}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
