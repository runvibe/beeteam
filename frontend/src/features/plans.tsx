import { useQuery } from "@tanstack/react-query";
import { useApi, useList } from "@/api/context";
import type { Task, PlanRevision } from "@/api/types";
import { useUrlState, usePageSize } from "@/routing/query";
import { Choice, QueryState, Pager, NoData } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Metadata } from "./plan-metadata";
import { PlanHistory } from "./plan-history";
import { Markdown } from "@/components/markdown";

export function Plans({ task }: { task: Task }) {
  const [offset, setOffset] = useUrlState<number>("plans.offset", 0);
  const limit = usePageSize("plans", 10);
  const [selected, setSelected] = useUrlState<string>("plans.selected", "", {
    resetOffsets: false,
  });
  const q = useList("plans", task.id, { offset, limit });
  const api = useApi();
  const selection = useQuery({
    queryKey: ["selected-plan", task.id, selected],
    queryFn: async () => {
      let offset = 0;
      while (true) {
        const page = await api.list("plans", task.id, { offset, limit: 100 });
        const found = page.items.find((p) => p.planId === selected);
        if (found) return found;
        if (!page.hasMore || page.nextOffset === null) return null;
        offset = page.nextOffset;
      }
    },
    enabled: !!selected,
  });
  const current = selected ? selection.data : q.data?.items[0];
  const options = q.data?.items.slice() ?? [];
  if (current && !options.some((p) => p.planId === current.planId))
    options.push(current);
  return (
    <div className="detail-section task-plans">
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.total > 1 && (
              <div className="task-plan-selection task-reading-block">
                <Choice
                  label="Plano"
                  value={current?.planId ?? ""}
                  onChange={setSelected}
                  options={options.map((p) => ({
                    value: p.planId,
                    label: p.title,
                  }))}
                />
                {q.data.total > q.data.limit && (
                  <Pager page={q.data} onOffset={setOffset} />
                )}
                <p className="small-note">
                  Cada plano tem seu próprio histórico de alterações.
                </p>
              </div>
            )}
            {selected && (
              <QueryState query={selection}>
                {selection.data === null && (
                  <>
                    <NoData title="Plano não encontrado" />
                    <Button onClick={() => setSelected("")}>
                      Ver planos disponíveis
                    </Button>
                  </>
                )}
              </QueryState>
            )}
            {current ? (
              <Plan key={current.planId} item={current} />
            ) : (
              !selected && <NoData title="Nenhum plano registrado" />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}
function Plan({ item }: { item: PlanRevision }) {
  const scope = `revision.${item.planId}`;
  const [selected, setSelected] = useUrlState<number>(`${scope}.selected`, 0, {
    resetOffsets: false,
  });
  const api = useApi();
  const historical = selected > 0 && selected !== item.revision;
  // Fetch the exact revision independently of history pagination, including shared URLs.
  const revision = useQuery({
    queryKey: ["revision", item.taskId, item.planId, selected],
    queryFn: async () => {
      let cursor = 0;
      while (true) {
        const page = await api.revisions(item.taskId, item.planId, {
          offset: cursor,
          limit: 100,
        });
        const found = page.items.find((p) => p.revision === selected);
        if (found) return found;
        if (!page.hasMore || page.nextOffset === null) return null;
        cursor = page.nextOffset;
      }
    },
    enabled: historical,
  });
  const displayed = historical ? revision.data : item;
  return (
    <article className="record task-plan">
      <h2>
        {historical ? `Versão anterior · Revisão ${selected}` : "Plano atual"}
      </h2>
      {historical && (
        <Button variant="outline" onClick={() => setSelected(0)}>
          Voltar ao plano atual
        </Button>
      )}
      {historical && (
        <QueryState query={revision}>
          {revision.data === null && <NoData title="Revisão não encontrada" />}
        </QueryState>
      )}
      {displayed && (
        <>
          <header className="task-reading-block">
            <h3>{displayed.title}</h3>
            <p className="small-note">Revisão {displayed.revision}</p>
            <Metadata item={displayed} />
          </header>
          <div className="task-plan-document task-reading-block">
            <Markdown headingOffset={2} sectionDividers>
              {displayed.content}
            </Markdown>
            {displayed.changeSummary && (
              <p className="small-note">Alteração: {displayed.changeSummary}</p>
            )}
          </div>
        </>
      )}
      <PlanHistory item={item} onSelect={setSelected} />
    </article>
  );
}
