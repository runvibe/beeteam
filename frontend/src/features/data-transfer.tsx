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
const storageKey = "bee-transfer-job";
const ongoing = (state: string) =>
  ["running", "restoring", "queued"].includes(state);
export function DataTransferSettings() {
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
              aria-label="Configurações globais"
              onClick={() => setOpen(true)}
            >
                <SlidersHorizontal aria-hidden="true" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
              Configurações globais
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>Exportar e importar dados</DialogTitle>
            <DialogDescription>
              Arquivo portátil da instalação Bee Team. A importação exige um
              destino vazio.
            </DialogDescription>
          </DialogHeader>
          <DataTransferPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}
export function DataTransferPanel() {
  const client = useQueryClient();
  const [jobId, setJobId] = useState(() => localStorage.getItem(storageKey));
  const [error, setError] = useState("");
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
    localStorage.setItem(storageKey, value.id);
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
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na transferência");
      if (e instanceof TransferError && e.activeJobId) {
        setJobId(e.activeJobId);
        localStorage.setItem(storageKey, e.activeJobId);
      }
    } finally {
      setBusy("");
    }
  };
  const importFile = (file: File) =>
    void run("Preparando arquivo", async () => {
      if (file.size > (info.data?.limits?.compressed ?? 0))
        throw new Error("Arquivo excede o limite de upload.");
      setPercent(0);
      const hash = await hashFile(file, setPercent);
      setBusy("Enviando arquivo");
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
  if (info.isPending) return <p role="status">Consultando configuração…</p>;
  if (info.error)
    return (
      <p role="alert">
        Não foi possível consultar a API.{" "}
        <Button onClick={() => void info.refetch()}>Tentar novamente</Button>
      </p>
    );
  if (!info.data?.enabled)
    return (
      <p>
        Transferência desativada nesta instalação. O administrador pode
        habilitá-la no servidor.
      </p>
    );
  return (
    <div className="transfer-settings">
      <p>
        O arquivo inclui anexos, histórico, registros excluídos logicamente e
        respostas de idempotência. Guarde-o em local apropriado.
      </p>
      <p>
        Limites: {Math.round(info.data.limits!.compressed / 1024 / 1024)} MiB
        por upload; {Math.round(info.data.limits!.expanded / 1024 / 1024)} MiB
        expandidos; {info.data.limits!.entries} entradas;{" "}
        {info.data.limits!.seconds / 60} minutos. Arquivos disponíveis por{" "}
        {info.data.retentionSeconds! / 3600} horas.
      </p>
      <div className="form-actions">
        <Button
          disabled={active}
          onClick={() =>
            void run("Iniciando exportação", async () =>
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
          Exportar dados
        </Button>
        <label>
          Importar arquivo .beeteam.zip{" "}
          <input
            aria-label="Arquivo de importação"
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
          {busy} {percent > 0 ? `${percent}%` : ""}
          {busy === "Enviando arquivo" && (
            <Button onClick={() => abort.current?.abort()}>
              Cancelar upload
            </Button>
          )}
        </div>
      )}
      {(error || job.error) && (
        <p role="alert">
          {error || job.error?.message}
          <Button onClick={() => void job.refetch()}>
            Consultar novamente
          </Button>
        </p>
      )}
      {job.data && (
        <section aria-label="Transferência atual">
          <p role="status">
            {job.data.state} · {job.data.stage} · {job.data.records} registros
          </p>
          <small>Job: {job.data.id}</small>
          {job.data.error && <p role="alert">{job.data.error}</p>}
          {job.data.kind === "export" && job.data.state === "ready" && (
            <a href={`${transferBase()}/exports/${job.data.id}/file`} download>
              Baixar .beeteam.zip
            </a>
          )}
          {ongoing(job.data.state) && (
            <Button
              disabled={!!busy}
              onClick={() =>
                void run("Cancelando", async () =>
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
              Cancelar transferência
            </Button>
          )}
          {preview && job.data.state === "ready" && (
            <div>
              <h3>Prévia da importação</h3>
              <p>
                Origem: {preview.manifest.sourceDriver} · Snapshot:{" "}
                {preview.manifest.snapshotAt}
              </p>
              <p>
                Destino: {preview.destinationDriver} ·{" "}
                {preview.destinationEmpty
                  ? "vazio"
                  : "contém dados — importação bloqueada"}
              </p>
              <ul>
                {Object.entries(preview.manifest.entries)
                  .filter(([, entry]) => entry.rows !== null)
                  .map(([name, entry]) => (
                    <li key={name}>
                      {name.replace("records/", "").replace(".jsonl", "")}:{" "}
                      {entry.rows}
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
                  Aceito truncar {preview.precisionChanges} timestamps para
                  microssegundos. O conteúdo JSON e Markdown será preservado.
                </label>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                Confirmo a restauração completa neste destino vazio, incluindo
                dados excluídos e histórico.
              </label>
              <Button
                disabled={
                  active ||
                  !confirmed ||
                  !preview.destinationEmpty ||
                  (preview.precisionChanges > 0 && !truncate)
                }
                onClick={() =>
                  void run("Restaurando", async () =>
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
                Restaurar dados
              </Button>
            </div>
          )}
          {!ongoing(job.data.state) && (
            <Button
              variant="ghost"
              onClick={() => {
                setJobId(null);
                localStorage.removeItem(storageKey);
                actionKeys.current.clear();
              }}
            >
              Nova transferência
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
