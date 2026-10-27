import { FilterBar } from "@/components/filter-bar";
import { EntityFilter } from "@/components/entity-filter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { useApi, useEntity, useList } from "@/api/context";
import type { Agent, Team } from "@/api/types";
import { useUi } from "@/state/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "@/components/agent-avatar";
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
  formatDate,
  safeUrl,
} from "@/components/shared";
import { AgentName } from "@/components/names";
import { SaveFeedback } from "./settings";
import { ProfileForm } from "./profile-form";
export function Agents() {
  const [name, setName] = useState(""),
    [role, setRole] = useState(""),
    [teamId, setTeam] = useState(""),
    [archived, setArchived] = useState("false"),
    [offset, setOffset] = useState(0);
  const open = useUi((s) => s.openAgent);
  const q = useList("agents", "", {
    name: name || undefined,
    teamId: teamId || undefined,
    role: (role as "leader" | "collaborator") || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit: 12,
    sortBy: "name",
  });
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Agentes</h1>
          <p>Perfis, instruções e contexto para continuar de onde parou.</p>
        </div>
      </header>
      <FilterBar
        search={
          <>
            <Search
              label="Buscar agentes"
              value={name}
              onChange={(v) => {
                setName(v);
                setOffset(0);
              }}
            />
          </>
        }
        active={!!(name || teamId || role || archived !== "false")}
        onClear={() => {
          setName("");
          setTeam("");
          setRole("");
          setArchived("false");
          setOffset(0);
        }}
      >
        <EntityFilter
          resource="teams"
          label="Time"
          value={teamId}
          onChange={(v) => {
            setTeam(v);
            setOffset(0);
          }}
        />
        <Choice
          label="Papel"
          value={role}
          onChange={(v) => {
            setRole(v);
            setOffset(0);
          }}
          options={[
            { value: "leader", label: "Líder" },
            { value: "collaborator", label: "Colaborador" },
          ]}
          all="Todos"
        />
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
              <div className="agent-grid">
                {q.data.items.map((a) => (
                  <Card key={a.id} className="agent-card">
                    <CardHeader>
                      <AgentAvatar agent={a} />
                      <CardTitle>
                        <button
                          className="card-link"
                          onClick={() => open(a.id)}
                        >
                          {a.name}
                        </button>
                      </CardTitle>
                      <CardDescription>{a.roleDescription}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {a.bindings.leaderTeamId && (
                          <Badge variant="secondary">Líder</Badge>
                        )}
                        {a.bindings.collaboratorTeamId && (
                          <Badge variant="outline">Colaborador</Badge>
                        )}
                        {!a.bindings.leaderTeamId &&
                          !a.bindings.collaboratorTeamId && (
                            <Badge variant="outline">Sem vínculo</Badge>
                          )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <span className="small-note">
                        Atualizado em {formatDate(a.updatedAt)}
                      </span>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <NoData
                title={
                  name || teamId || role
                    ? "Nenhum agente corresponde aos filtros"
                    : "Nenhum agente neste cadastro"
                }
                description="Ajuste os filtros para consultar outros agentes."
              />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </>
  );
}
export function AgentDialog() {
  const id = useUi((s) => s.agentId),
    open = useUi((s) => s.openAgent);
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && open(null)}>
      <DialogContent className="detail-dialog">
        {id ? (
          <AgentDetail key={id} id={id} />
        ) : (
          <DialogTitle>Perfil</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
function AgentDetail({ id }: { id: string }) {
  const q = useEntity("agents", id);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{q.data?.name ?? "Perfil do agente"}</DialogTitle>
        <DialogDescription>
          {q.data?.roleDescription ?? "Perfil e contexto registrados."}
        </DialogDescription>
      </DialogHeader>
      <QueryState query={q}>
        {q.data && (
          <>
            <div className="flex items-center gap-3">
              <AgentAvatar agent={q.data} />
              <div>
                <Badge variant="secondary">
                  {q.data.archivedAt ? "Arquivado" : "Cadastro ativo"}
                </Badge>
                <p className="small-note">
                  Última atualização: {formatDate(q.data.updatedAt)}
                </p>
              </div>
            </div>
            <Tabs defaultValue="profile">
              <TabsList className="detail-tabs">
                <TabsTrigger value="profile">Perfil</TabsTrigger>
                <TabsTrigger value="activities">Tasks</TabsTrigger>
                <TabsTrigger value="chats">Chats</TabsTrigger>
                <TabsTrigger value="resume">Retomada</TabsTrigger>
                <TabsTrigger value="edit">Configurar</TabsTrigger>
              </TabsList>
              <TabsContent value="profile">
                <Profile agent={q.data} />
              </TabsContent>
              <TabsContent value="activities">
                <Activities agentId={id} />
              </TabsContent>
              <TabsContent value="chats">
                <Chats agentId={id} />
              </TabsContent>
              <TabsContent value="resume">
                <Resume agentId={id} />
              </TabsContent>
              <TabsContent value="edit">
                <ProfileForm key={q.data.version} agent={q.data} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </QueryState>
    </>
  );
}
function Profile({ agent }: { agent: Agent }) {
  return (
    <div className="detail-section">
      <h3>Vínculos</h3>
      {agent.bindings.leaderTeamId && (
        <TeamLink id={agent.bindings.leaderTeamId} role="Líder" />
      )}
      {agent.bindings.collaboratorTeamId && (
        <TeamLink id={agent.bindings.collaboratorTeamId} role="Colaborador" />
      )}
      {!agent.bindings.leaderTeamId && !agent.bindings.collaboratorTeamId && (
        <p className="small-note">Sem vínculos atuais.</p>
      )}
      <h3>Estilo de trabalho</h3>
      <TextBlock>{agent.workStyle}</TextBlock>
      <h3>Instruções</h3>
      <TextBlock>{agent.workInstructions}</TextBlock>
      <h3>Regras</h3>
      <TextBlock>{agent.rules.join("\n")}</TextBlock>
      <h3>Limites de acesso</h3>
      <TextBlock>{agent.accessLimits.join("\n")}</TextBlock>
      <p className="small-note">As permissões reais pertencem ao harness.</p>
      <h3>Contexto resumido</h3>
      <TextBlock>{agent.contextSummary}</TextBlock>
    </div>
  );
}
function TeamLink({ id, role }: { id: string; role: string }) {
  const q = useEntity("teams", id),
    open = useUi((s) => s.openTeam);
  return (
    <Button variant="outline" onClick={() => open(id)}>
      {role} · {q.data?.name ?? "Time"}
      <ArrowUpRight data-icon="inline-end" />
    </Button>
  );
}
function Activities({ agentId }: { agentId: string }) {
  const [offset, setOffset] = useState(0),
    [relation, setRelation] = useState("any"),
    [title, setTitle] = useState("");
  const q = useList("activities", agentId, {
    relation: relation as "any" | "authored" | "executing" | "worked",
    title: title || undefined,
    offset,
    limit: 10,
    sortBy: "taskUpdatedAt",
    sortOrder: "desc",
  });
  const open = useUi((s) => s.openTask);
  return (
    <div className="detail-section">
      <FilterBar
        search={
          <>
            <Search
              value={title}
              onChange={(v) => {
                setTitle(v);
                setOffset(0);
              }}
              label="Buscar tasks do agente"
            />
          </>
        }
        active={!!(title || relation !== "any")}
        onClear={() => {
          setTitle("");
          setRelation("any");
          setOffset(0);
        }}
      >
        <Choice
          label="Relação"
          value={relation}
          onChange={(v) => {
            setRelation(v);
            setOffset(0);
          }}
          options={[
            { value: "any", label: "Todas" },
            { value: "authored", label: "Autoria" },
            { value: "executing", label: "Executor atual" },
            { value: "worked", label: "Com resumo próprio" },
          ]}
        />
      </FilterBar>
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.map((a) => (
              <article className="record" key={a.taskId}>
                <button className="record-link" onClick={() => open(a.taskId)}>
                  {a.title}
                </button>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {a.isCurrentExecutor
                      ? "Executor atual"
                      : "Histórico preservado"}
                  </Badge>
                  <span className="small-note">
                    {formatDate(a.taskUpdatedAt)}
                  </span>
                </div>
              </article>
            ))}
            {!q.data.items.length && (
              <NoData
                title="Nenhuma task corresponde aos filtros"
                description="Ajuste a busca ou a relação com este agente."
              />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </div>
  );
}
function Chats({ agentId }: { agentId: string }) {
  const [offset, setOffset] = useState(0);
  const q = useList("chats", agentId, { offset, limit: 10 });
  return (
    <div className="detail-section">
      <p className="muted-copy">
        Referências externas registradas. Não indicam sessões em execução.
      </p>
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.map((c) => (
              <article className="record" key={c.id}>
                <h3>{c.label}</h3>
                <p className="small-note">
                  {c.harness} · {c.externalId} · {formatDate(c.updatedAt)}
                </p>
                {safeUrl(c.url) && (
                  <a href={safeUrl(c.url)} target="_blank" rel="noreferrer">
                    Abrir referência <ExternalLink size={14} />
                  </a>
                )}
              </article>
            ))}
            {!q.data.items.length && (
              <NoData title="Sem referências de chats" />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </div>
  );
}
function Resume({ agentId }: { agentId: string }) {
  const api = useApi();
  const q = useQuery({
    queryKey: ["resume", agentId],
    queryFn: () => api.resume(agentId),
  });
  return (
    <div className="detail-section">
      <QueryState query={q}>
        {q.data && (
          <>
            <p className="muted-copy">{q.data.notice}</p>
            <h3>Instruções para retomada</h3>
            <TextBlock>{q.data.agent.workInstructions}</TextBlock>
            <h3>Contexto resumido</h3>
            <TextBlock>{q.data.agent.contextSummary}</TextBlock>
            {q.data.teamContexts.map((t) => (
              <article className="record" key={t.teamId}>
                <h3>{t.name}</h3>
                <TextBlock>{t.purpose}</TextBlock>
                <TextBlock>{t.context}</TextBlock>
              </article>
            ))}
            <p className="small-note">
              Contexto consultado em {formatDate(q.data.generatedAt)}.
              Resultados e pendências continuam nas tasks.
            </p>
          </>
        )}
      </QueryState>
    </div>
  );
}
export function Teams() {
  const [name, setName] = useState(""),
    [offset, setOffset] = useState(0),
    [archived, setArchived] = useState("false");
  const q = useList("teams", "", {
    name: name || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit: 12,
    sortBy: "name",
  });
  const open = useUi((s) => s.openTeam);
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
                  <Card key={t.id}>
                    <CardHeader>
                      <CardTitle>
                        <button
                          className="card-link"
                          onClick={() => open(t.id)}
                        >
                          {t.name}
                        </button>
                      </CardTitle>
                      <CardDescription>{t.purpose}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TextBlock>{t.context}</TextBlock>
                    </CardContent>
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
export function TeamDialog() {
  const id = useUi((s) => s.teamId),
    open = useUi((s) => s.openTeam);
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && open(null)}>
      <DialogContent className="detail-dialog">
        {id ? <TeamDetail key={id} id={id} /> : <DialogTitle>Time</DialogTitle>}
      </DialogContent>
    </Dialog>
  );
}
function TeamDetail({ id }: { id: string }) {
  const q = useEntity("teams", id),
    [offset, setOffset] = useState(0),
    [boardOffset, setBoardOffset] = useState(0);
  const members = useList("members", id, { offset, limit: 10, sortBy: "name" }),
    boards = useList("boards", "", {
      teamId: id,
      offset: boardOffset,
      limit: 10,
    });
  const openBoard = useUi((s) => s.openBoard),
    close = useUi((s) => s.openTeam);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{q.data?.name ?? "Time"}</DialogTitle>
        <DialogDescription>
          Composição e boards geridos. Tasks mantêm autor e executor
          independentemente do time.
        </DialogDescription>
      </DialogHeader>
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
                        close(null);
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
            <details className="metadata-editor">
              <summary>Editar metadados do time</summary>
              <TeamForm key={q.data.version} team={q.data} />
            </details>
          </>
        )}
      </QueryState>
    </>
  );
}
function TeamForm({ team }: { team: Team }) {
  const [name, setName] = useState(team.name),
    [purpose, setPurpose] = useState(team.purpose),
    [context, setContext] = useState(team.context);
  const api = useApi(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.patch("teams", team.id, { name, purpose, context }, team.version),
    onSuccess: () => client.invalidateQueries(),
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
      <SaveFeedback mutation={mutation} />
    </form>
  );
}
