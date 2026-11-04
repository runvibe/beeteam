import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Page, Resources } from "@/api/types";
import { nextPageOffset } from "@/api/page-continuation";
import { Failure } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { Attachment } from "./attachment-item";

async function findReference<T extends { id: string }>(
  fetchPage: (offset: number) => Promise<Page<T>>,
  matches: (row: T) => boolean,
) {
  const pages: Page<T>[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset);
    pages.push(page);
    const found = page.items.find(matches);
    if (found) return found;
    const next = nextPageOffset(page, pages, (row) => row.id);
    if (next === undefined) {
      if (page.hasMore)
        throw new Error("Paginação incompleta do conteúdo referenciado.");
      return null;
    }
    offset = next;
  }
}
export function TimelineEventReference({
  event,
}: {
  event: Resources["timeline"];
}) {
  const api = useApi(),
    d = event.data;
  const q = useQuery({
    queryKey: ["timeline-reference", event.taskId, event.id, event.type, d],
    queryFn: async ({ signal }) => {
      if (event.type === "comment.created" && typeof d.commentId === "string") {
        const value = await api.comment(event.taskId, d.commentId, signal);
        return value.id === d.commentId &&
          value.taskId === event.taskId &&
          !value.deletedAt
          ? { kind: "comment" as const, value }
          : null;
      }
      if (
        (event.type === "plan.created" || event.type === "plan.revised") &&
        typeof d.planId === "string" &&
        (typeof d.revisionId === "string" || typeof d.revision === "number")
      ) {
        const planId = d.planId;
        const value = await findReference(
          (offset) =>
            api.revisions(
              event.taskId,
              planId,
              { offset, limit: 100, sortBy: "revision", sortOrder: "asc" },
              signal,
            ),
          (row) =>
            row.taskId === event.taskId &&
            row.planId === planId &&
            !row.deletedAt &&
            (typeof d.revisionId === "string"
              ? row.id === d.revisionId
              : row.revision === d.revision),
        );
        return value ? { kind: "plan" as const, value } : null;
      }
      if (
        (event.type === "attachment.added" ||
          event.type === "attachment.removed") &&
        typeof d.attachmentId === "string"
      ) {
        const value = await findReference(
          (offset) =>
            api.list(
              "attachments",
              event.taskId,
              { offset, limit: 100, includeRemoved: true },
              signal,
            ),
          (row) => row.taskId === event.taskId && row.id === d.attachmentId,
        );
        return value ? { kind: "attachment" as const, value } : null;
      }
      return null;
    },
  });
  if (q.isPending) return <p role="status">Carregando conteúdo do evento…</p>;
  if (q.error)
    return (
      <div>
        <p className="small-note">Conteúdo referenciado indisponível.</p>
        <Failure error={q.error} retry={() => void q.refetch()} />
      </div>
    );
  if (!q.data)
    return (
      <p className="small-note">
        Conteúdo referenciado indisponível ou não registrado.
      </p>
    );
  if (q.data.kind === "attachment") return <Attachment item={q.data.value} />;
  if (q.data.kind === "comment")
    return (
      <section className="task-reading-block" aria-label="Comentário">
        <Markdown headingOffset={2} sectionDividers>
          {q.data.value.body}
        </Markdown>
      </section>
    );
  return (
    <section className="task-reading-block" aria-label="Revisão do plano">
      <h4>{q.data.value.title}</h4>
      <p className="small-note">Revisão {q.data.value.revision}</p>
      {q.data.value.changeSummary && (
        <section aria-label="Motivo da revisão">
          <h5>Alteração registrada</h5>
          <Markdown headingOffset={2}>{q.data.value.changeSummary}</Markdown>
        </section>
      )}
      <Markdown headingOffset={2} sectionDividers>
        {q.data.value.content}
      </Markdown>
    </section>
  );
}
