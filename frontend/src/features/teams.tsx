import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  CardDescription,
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
import { SaveFeedback } from "./settings";
export function Teams() {
  const [name, setName] = useUrlState<string>("teams.name", ""),
    [offset, setOffset] = useUrlState<number>("teams.offset", 0),
    [archived, setArchived] = useUrlState<string>("teams.archived", "false", {
      values: booleanValues,
    });
  const limit = usePageSize("teams", 12);
  const q = useList("teams", "", {
    name: name || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit,
    sortBy: "name",
  });
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Times</h1>
          <p>Um líder por time. Uma identidade por agente.</p>
        </div>
      </header>
      <FilterBar
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
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.length ? (
              <div className="board-grid">
                {q.data.items.map((t) => (
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
                        <CardDescription>{t.purpose}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <TextBlock>{t.context}</TextBlock>
                      </CardContent>
                    </a>
                    <CardFooter className="justify-between">
                      <AgentName id={t.leaderId} />
                      <Badge variant="outline">
                        {t.collaboratorCount} colaboradores
                      </Badge>
                    </CardFooter>
                  </Card>
                ))}
              </div>
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
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
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
  const [team, setBaseline] = useState(latest);
  const [name, setName] = useState(team.name),
    [purpose, setPurpose] = useState(team.purpose),
    [context, setContext] = useState(team.context);
  const api = useApi(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.patch("teams", team.id, { name, purpose, context }, team.version),
    onSuccess: (saved) => {
      setBaseline(saved);
      return client.invalidateQueries();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="detail-section"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="team-name">Nome</FieldLabel>
          <Input
            id="team-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-purpose">Propósito</FieldLabel>
          <Textarea
            id="team-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-context">Contexto</FieldLabel>
          <Textarea
            id="team-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button disabled={mutation.isPending || !!team.archivedAt} type="submit">
        Salvar metadados
      </Button>
      {latest.version > team.version && (
        <p role="status" className="small-note">
          Este registro foi atualizado em outra sessão. Seu rascunho foi
          preservado; feche e reabra a configuração para carregar a versão atual
          antes de editar novamente.
        </p>
      )}
      <SaveFeedback mutation={mutation} />
    </form>
  );
}
