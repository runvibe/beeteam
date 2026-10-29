import { TeamCardLinks } from "@/components/team-card-links";
import { CardExcerpt } from "@/components/card-excerpt";
import { useCardPages } from "@/api/card-pages";
import { CardListViewport } from "@/components/card-list-viewport";
import { BalancedCardGrid } from "@/components/balanced-card-grid";
import { ArrowUpRight } from "lucide-react";
import { useLocation, navigate, destination } from "@/routing/location";
import { openCardLink, openCardBody } from "@/routing/card-navigation";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { useApi, useEntity, useList } from "@/api/context";
import type { Team } from "@/api/types";
import { useUi } from "@/state/ui";
import { DetailPage } from "@/components/detail-page";
import { FilterBar } from "@/components/filter-bar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Choice,
  Search,
  QueryState,
  NoData,
  Pager,
  TextBlock,
} from "@/components/shared";
import { AgentName } from "@/components/names";
import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
export function Teams() {
  const [name, setName] = useUrlState<string>("teams.name", ""),
    [offset, setOffset] = useUrlState<number>("teams.offset", 0),
    [archived, setArchived] = useUrlState<string>("teams.archived", "false", {
      values: booleanValues,
    });
  const limit = usePageSize("teams", 12);
  const q = useCardPages("teams", {
    name: name || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit,
    sortBy: "name",
  });
  return (
    <>
      <header className="page-heading listing-heading">
        <div className="sr-only">
          <h1>Times</h1>
          <p>Um líder por time. Uma identidade por agente.</p>
        </div>
        <FilterBar
          inHeader
          search={
            <>
              <Search
                label="Buscar times"
                value={name}
                onChange={(v) => {
                  setName(v);
                  setOffset(0);
                }}
              />
            </>
          }
          active={!!(name || archived !== "false")}
          onClear={() => {
            setName("");
            setArchived("false");
            setOffset(0);
          }}
        >
          <Choice
            label="Cadastro"
            value={archived}
            onChange={(v) => {
              setArchived(v);
              setOffset(0);
            }}
            options={[
              { value: "false", label: "Ativos" },
              { value: "true", label: "Arquivados" },
            ]}
          />
        </FilterBar>
      </header>
      <CardListViewport key={q.identity} state={q} label="Lista de times">
        {q.items && (
          <>
            {q.items.length ? (
              <BalancedCardGrid className="board-grid">
                {q.items.map((t) => (
                  <Card
                    key={t.id}
                    className="board-card team-card"
                    onClick={(e) =>
                      openCardBody(e, destination(`/teams/${t.slug}`))
                    }
                  >
                    <a
                      className="task-card-main"
                      aria-label={t.name}
                      href={destination(`/teams/${t.slug}`)}
                      onClick={openCardLink}
                    >
                      <CardHeader>
                        <CardTitle>{t.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardExcerpt
                          text={[t.purpose, t.context]
                            .filter(Boolean)
                            .join("\n\n")}
                        />
                      </CardContent>
                    </a>
                    <CardFooter className="justify-between">
                      <TeamCardLinks team={t} />
                    </CardFooter>
                  </Card>
                ))}
              </BalancedCardGrid>
            ) : (
              <NoData
                title={
                  name
                    ? "Nenhum time corresponde aos filtros"
                    : "Nenhum time neste cadastro"
                }
                description="Ajuste os filtros para consultar outros times."
              />
            )}
          </>
        )}
      </CardListViewport>
    </>
  );
}
export function TeamPage() {
  const id = useUi((s) => s.teamId);
  return id ? <TeamDetail key={id} id={id} /> : null;
}
function TeamDetail({ id }: { id: string }) {
  const configuring = useLocation().split("?")[0].endsWith("/settings");
  const q = useEntity("teams", id),
    [offset, setOffset] = useUrlState<number>("members.offset", 0),
    [boardOffset, setBoardOffset] = useUrlState<number>(
      "managedBoards.offset",
      0,
    );
  const memberLimit = usePageSize("members", 10),
    boardLimit = usePageSize("managedBoards", 10);
  const members = useList("members", id, {
      offset,
      limit: memberLimit,
      sortBy: "name",
    }),
    boards = useList("boards", "", {
      teamId: id,
      offset: boardOffset,
      limit: boardLimit,
    });
  const openBoard = useUi((s) => s.openBoard);
  return (
    <DetailPage
      label="Time"
      title={q.data?.name ?? "Time"}
      description="Composição e boards geridos. Tasks mantêm autor e executor independentemente do time."
      fallback="/teams"
    >
      <QueryState query={q}>
        {q.data && (
          <>
            <div className="team-intro">
              <TextBlock>{q.data.purpose}</TextBlock>
              <TextBlock>{q.data.context}</TextBlock>
            </div>
            <h3>Agentes</h3>
            <QueryState query={members}>
              {members.data && (
                <>
                  {members.data.items.map((m) => (
                    <div key={m.agentId} className="record-row">
                      <AgentName id={m.agentId} />
                      <Badge variant="outline">
                        {m.role === "leader" ? "Líder" : "Colaborador"}
                      </Badge>
                    </div>
                  ))}
                  <Pager page={members.data} onOffset={setOffset} />
                </>
              )}
            </QueryState>
            <h3>Boards geridos</h3>
            <QueryState query={boards}>
              {boards.data && (
                <>
                  {boards.data.items.map((b) => (
                    <Button
                      key={b.id}
                      variant="outline"
                      onClick={() => {
                        openBoard(b.id);
                      }}
                    >
                      {b.name}
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  ))}
                  {!boards.data.items.length && (
                    <NoData title="Nenhum board vinculado" />
                  )}
                  <Pager page={boards.data} onOffset={setBoardOffset} />
                </>
              )}
            </QueryState>
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/teams/${q.data.slug}/settings${location.search}`)
              }
            >
              Editar metadados do time
            </Button>
            <Dialog
              open={configuring}
              onOpenChange={(v) =>
                !v && navigate(`/teams/${q.data.slug}${location.search}`, true)
              }
            >
              <DialogContent className="detail-dialog">
                <DialogHeader>
                  <DialogTitle>Configurar {q.data.name}</DialogTitle>
                  <DialogDescription>
                    Editar metadados do time.
                  </DialogDescription>
                </DialogHeader>
                <TeamForm key={q.data.id} team={q.data} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </QueryState>
    </DetailPage>
  );
}
function TeamForm({ team: latest }: { team: Team }) {
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "teams",
    load: () => api.get("teams", latest.id),
    latest,
    values: (team: Team) => ({
      name: team.name,
      purpose: team.purpose,
      context: team.context,
    }),
    save: (draft, version) => api.patch("teams", latest.id, draft, version),
  });
  const { name, purpose, context } = autosave.draft;
  return (
    <form {...autosave.formProps} className="detail-section">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="team-name">Nome</FieldLabel>
          <Input
            id="team-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => autosave.change("name", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-purpose">Propósito</FieldLabel>
          <Textarea
            id="team-purpose"
            value={purpose}
            onChange={(e) => autosave.change("purpose", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-context">Contexto</FieldLabel>
          <Textarea
            id="team-context"
            value={context}
            onChange={(e) => autosave.change("context", e.target.value)}
          />
        </Field>
      </FieldGroup>
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          Este registro foi atualizado em outra sessão. Seu rascunho foi
          preservado. Use Recarregar formulário após o conflito para descartar o
          rascunho e carregar a versão atual.
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
