import { useRef, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Task, PlanRevision } from "@/api/types";
import { useUrlState } from "@/routing/query";
import { QueryState, NoData } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Metadata } from "./plan-metadata";
import { PlanHistory } from "./plan-history";
import { usePlanPages } from "./plan-pages";
import { PlanNavigation } from "./plan-navigation";
import { Markdown } from "@/components/markdown";

export function Plans({
  task,
  revealConsumed,
}: {
  task: Task;
  revealConsumed?: RefObject<boolean>;
}) {
  const ownRevealConsumed = useRef(false);
  const [selected, setSelected] = useUrlState<string>("plans.selected", "", {
    resetOffsets: false,
  });
  const api = useApi();
  const selection = useQuery({
    queryKey: ["selected-plan", task.id, selected],
    queryFn: async () =>
      (
        await api.revisions(task.id, selected, {
          offset: 0,
          limit: 1,
          sortBy: "revision",
          sortOrder: "desc",
        })
      ).items[0] ?? null,
    enabled: !!selected,
  });
  const plans = usePlanPages(task.id, selected, selection.data != null);
  const current = selected
    ? selection.data === undefined
      ? plans.items.find((item) => item.planId === selected)
      : selection.data
    : plans.items[0];
  return (
    <div className="detail-section task-plans">
      {plans.query.isPending ? (
        <QueryState query={plans.query}>{null}</QueryState>
      ) : (
        <PlanNavigation
          taskId={task.id}
          revealConsumed={revealConsumed ?? ownRevealConsumed}
          plans={plans}
          current={current}
          selectedId={selected || current?.planId}
          onSelect={setSelected}
        >
          {selected && (!current || selection.error) && (
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
            !selected &&
            !plans.query.error && <NoData title="Nenhum plano registrado" />
          )}
        </PlanNavigation>
      )}
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
