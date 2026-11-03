import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { SummaryUsage } from "./summary-usage";
export function RecordedSummary({
  taskId,
  summaryId,
  reportedAt,
}: {
  taskId: string;
  summaryId: string;
  reportedAt?: string;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["usage-checkpoint-summary", taskId, summaryId],
    enabled: open,
    queryFn: async ({ signal }) => {
      let offset = 0;
      // Same timestamp may contain several summaries; resolve by immutable ID.
      for (;;) {
        const page = await api.list(
          "summaries",
          taskId,
          {
            createdFrom: reportedAt,
            sortBy: "createdAt",
            sortOrder: "asc",
            limit: 100,
            offset,
          },
          signal,
        );
        const match = page.items.find((row) => row.id === summaryId);
        if (match) return match;
        if (
          !page.hasMore ||
          page.nextOffset === null ||
          page.nextOffset <= offset
        )
          break;
        offset = page.nextOffset;
      }
      throw new Error("Resumo não encontrado nos registros disponíveis.");
    },
  });
  return (
    <div>
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Fechar resumo" : "Abrir resumo"}
      </Button>
      {open && (
        <section aria-label="Resumo selecionado">
          {query.isPending && <p role="status">Carregando resumo…</p>}
          {query.error && (
            <Failure error={query.error} retry={() => void query.refetch()} />
          )}
          {query.data && (
            <>
              <Markdown headingOffset={2}>{query.data.summary}</Markdown>
              <SummaryUsage report={query.data.usageReport} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
