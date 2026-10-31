import { RelativeTime } from "@/components/relative-time";
import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { useApi } from "@/api/context";
import type { TaskOverviewData, OverviewActor } from "@/api/task-overview";
import { AgentName } from "@/components/names";
import { Button } from "@/components/ui/button";
import { Failure, formatDate, safeUrl } from "@/components/shared";

export function OverviewAttribution({
  actor,
  date,
  relative = false,
}: {
  actor: OverviewActor;
  date: string;
  relative?: boolean;
}) {
  return (
    <p className="small-note">
      {actor.actorKind === "human" ? (
        "Pessoa · identidade não informada"
      ) : actor.actorId ? (
        <AgentName id={actor.actorId} />
      ) : (
        "Agente não identificado"
      )}{" "}
      · {relative ? <RelativeTime value={date} /> : <time dateTime={date}>{formatDate(date)}</time>}
    </p>
  );
}
export function OverviewArtifacts({
  data,
  onTab,
}: {
  data: TaskOverviewData;
  onTab: (tab: string) => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null);
  async function download(id: string, name: string) {
    setBusy(id);
    setError(null);
    try {
      const blob = await api.download(data.task.id, id),
        url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="overview-artifacts">
      <h2>Entregas e arquivos recentes</h2>
      {!!data.latestDeliverables.items.length && (
        <ul className="overview-feed">
          {data.latestDeliverables.items.slice(0, 5).map((item, index) => (
            <li key={`${item.summaryId}-${index}`}>
              <div>
                {safeUrl(item.deliverable.url) ? (
                  <a
                    className="overview-artifact-link"
                    href={safeUrl(item.deliverable.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.deliverable.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <span>{item.deliverable.label}</span>
                )}
                {item.deliverable.attachmentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!busy}
                    onClick={() =>
                      void download(
                        item.deliverable.attachmentId!,
                        item.deliverable.label,
                      )
                    }
                    aria-label={`Baixar entrega ${item.deliverable.label}`}
                  >
                    <Download size={14} />
                    Baixar
                  </Button>
                )}
              </div>
              <OverviewAttribution actor={item} date={item.createdAt} />
            </li>
          ))}
        </ul>
      )}
      {!!data.latestAttachments.items.length && (
        <ul className="overview-feed">
          {data.latestAttachments.items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Button
                variant="link"
                disabled={!!busy}
                className="overview-file-link"
                onClick={() => void download(item.id, item.originalName)}
              >
                <Download size={14} aria-hidden="true" />
                {item.originalName}
              </Button>
              <OverviewAttribution actor={item} date={item.createdAt} />
            </li>
          ))}
        </ul>
      )}
      {!data.latestDeliverables.total && !data.latestAttachments.total && (
        <p className="small-note">Nenhuma entrega ou arquivo registrado.</p>
      )}
      {(data.latestDeliverables.total > 5 ||
        data.latestAttachments.total > 5) && (
        <p className="small-note">Até 5 entregas e 5 arquivos mais recentes.</p>
      )}
      <div className="overview-feed-actions">
        <Button variant="ghost" size="sm" onClick={() => onTab("summaries")}>
          Ver entregas nos resumos
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onTab("attachments")}>
          Ver arquivos ({data.latestAttachments.total})
        </Button>
      </div>
      {error != null && <Failure error={error} />}
    </section>
  );
}

const eventNames: Record<string, string> = {
  "task.created": "Tarefa criada",
  "task.updated": "Tarefa atualizada",
  "assignment.changed": "Responsável alterado",
  "block.changed": "Bloqueio atualizado",
  "plan.created": "Plano registrado",
  "plan.revised": "Plano revisado",
  "comment.created": "Comentário registrado",
  "attachment.added": "Arquivo anexado",
  "attachment.removed": "Arquivo removido logicamente",
  "execution.recorded": "Execução registrada",
  "task.archived": "Tarefa arquivada",
  "task.restored": "Tarefa restaurada",
  "subtask.created": "Subtarefa criada",
  "position.changed": "Posição alterada",
};
export function OverviewActivity({
  data,
  onTab,
}: {
  data: TaskOverviewData;
  onTab: (tab: string) => void;
}) {
  return (
    <section>
      <h2>Atividade recente</h2>
      {data.recentEvents.items.length ? (
        <ol className="overview-feed">
          {data.recentEvents.items.slice(0, 5).map((event) => (
            <li key={event.id}>
              <span>{eventNames[event.type] || event.type}</span>
              <OverviewAttribution actor={event} date={event.occurredAt} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="small-note">Nenhuma atividade registrada.</p>
      )}
      <Button variant="ghost" size="sm" onClick={() => onTab("timeline")}>
        Ver timeline ({data.recentEvents.total})
      </Button>
    </section>
  );
}
