import { CardKindMark } from "@/components/card-kind-mark";
import { CardSymbol } from "@/components/card-symbol";
import { RelativeTime } from "@/components/relative-time";
import { CardExcerpt } from "@/components/card-excerpt";
import { useCardPages } from "@/api/card-pages";
import { CardListViewport } from "@/components/card-list-viewport";
import { BalancedCardGrid } from "@/components/balanced-card-grid";
import { DetailPage } from "@/components/detail-page";
import { openCardLink } from "@/routing/card-navigation";
import { useLocation, navigate, destination } from "@/routing/location";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { EntityFilter } from "@/components/entity-filter";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { useApi, useEntity, useList } from "@/api/context";
import type { Agent } from "@/api/types";
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
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
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
import { ProfileForm } from "./profile-form";
export function Agents() {
  const [name, setName] = useUrlState<string>("agents.name", ""),
    [role, setRole] = useUrlState<string>("agents.role", "", {
      values: ["", "leader", "collaborator"],
    }),
    [teamId, setTeam] = useUrlState<string>("agents.teamId", ""),
    [archived, setArchived] = useUrlState<string>("agents.archived", "false", {
      values: booleanValues,
    }),
    [offset, setOffset] = useUrlState<number>("agents.offset", 0);
  const limit = usePageSize("agents", 12);
  const q = useCardPages("agents", {
    name: name || undefined,
    teamId: teamId || undefined,
    role: (role as "leader" | "collaborator") || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit,
    sortBy: "name",
  });
  return (
    <>
      <header className="page-heading listing-heading">
        <div className="sr-only">
          <h1>Agentes</h1>
          <p>Perfis, instruções e contexto para continuar de onde parou.</p>
        </div>
        <FilterBar
          inHeader
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
      </header>
      <CardListViewport key={q.identity} state={q} label="Lista de agentes">
        {q.items && (
          <>
            {q.items.length ? (
              <BalancedCardGrid className="agent-grid">
                {q.items.map((a) => (
                  <a
                    key={a.id}
                    className="board-card-link"
                    aria-label={a.name}
                    href={destination(`/agents/${a.slug}`)}
                    onClick={openCardLink}
                  >
                    <Card className="agent-card board-card">
                      <CardKindMark kind="agent" />
                      <CardHeader>
                        <AgentAvatar agent={a} />
                        <CardTitle>{a.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardExcerpt text={a.roleDescription} />
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {a.bindings.leaderTeamId && (
                            <CardSymbol kind="leader" />
                          )}
                          {a.bindings.collaboratorTeamId && (
                            <CardSymbol kind="collaborator" />
                          )}
                          {!a.bindings.leaderTeamId &&
                            !a.bindings.collaboratorTeamId && (
                              <CardSymbol kind="unbound" />
                            )}
                        </div>
                        <span className="small-note">
                          <RelativeTime value={a.updatedAt} />
                        </span>
                      </CardFooter>
                    </Card>
                  </a>
                ))}
              </BalancedCardGrid>
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
          </>
        )}
      </CardListViewport>
    </>
  );
}
export function AgentPage() {
  const id = useUi((s) => s.agentId);
  return id ? <AgentDetail key={id} id={id} /> : null;
}
function AgentDetail({ id }: { id: string }) {
  const q = useEntity("agents", id);
  const [tab, setTab] = useUrlState<string>("agent.tab", "profile", {
    values: ["profile", "activities", "chats", "resume"],
  });
  const configuring = useLocation().split("?")[0].endsWith("/settings");
  return (
    <DetailPage
      label="Agente"
      title={q.data?.name ?? "Perfil do agente"}
      description={q.data?.roleDescription ?? "Perfil e contexto registrados."}
      fallback="/agents"
    >
      <QueryState query={q}>
        {q.data && (
          <>
            <div className="entity-page-meta">
              <AgentAvatar agent={q.data} />
              <div>
                <Badge variant="secondary">
                  {q.data.archivedAt ? "Arquivado" : "Cadastro ativo"}
                </Badge>
                <p className="small-note">
                  Última atualização: {formatDate(q.data.updatedAt)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/agents/${q.data.slug}/settings${location.search}`)
                }
              >
                Configurar
              </Button>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="detail-tabs">
                <TabsTrigger value="profile">Perfil</TabsTrigger>
                <TabsTrigger value="activities">Tasks</TabsTrigger>
                <TabsTrigger value="chats">Chats</TabsTrigger>
                <TabsTrigger value="resume">Retomada</TabsTrigger>
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
            </Tabs>
            <Dialog
              open={configuring}
              onOpenChange={(v) =>
                !v && navigate(`/agents/${q.data.slug}${location.search}`, true)
              }
            >
              <DialogContent className="detail-dialog">
                <DialogHeader>
                  <DialogTitle>{q.data.name}</DialogTitle>
                  <DialogDescription>
                    Configurações do perfil do agente.
                  </DialogDescription>
                </DialogHeader>
                <ProfileForm key={q.data.id} agent={q.data} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </QueryState>
    </DetailPage>
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
  const [offset, setOffset] = useUrlState<number>("activities.offset", 0),
    [relation, setRelation] = useUrlState<string>(
      "activities.relation",
      "any",
      { values: ["any", "authored", "executing", "worked"] },
    ),
    [title, setTitle] = useUrlState<string>("activities.title", "");
  const limit = usePageSize("activities", 10);
  const q = useList("activities", agentId, {
    relation: relation as "any" | "authored" | "executing" | "worked",
    title: title || undefined,
    offset,
    limit,
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
  const [offset, setOffset] = useUrlState<number>("chats.offset", 0);
  const limit = usePageSize("chats", 10);
  const q = useList("chats", agentId, { offset, limit });
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
                <CardExcerpt text={t.context} />
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
