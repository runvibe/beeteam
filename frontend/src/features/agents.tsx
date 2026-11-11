import {
  AgentRoleSymbol,
  TeamRoleIcon,
  roleIconId,
  type TeamRole,
} from "@/components/team-role-icon";
import { AgentLatestActivity } from "./agent-latest-activity";
import { AgentChats } from "./agent-chats";
import { AgentManagedDetails } from "./agent-managed-details";
import { DetailRecordList } from "./detail-record-list";
import { useLocale, t as tr } from "@/i18n";

import { CardKindMark } from "@/components/card-kind-mark";
import { CardSymbol } from "@/components/card-symbol";
import { RelativeTime } from "@/components/relative-time";
import { CardExcerpt } from "@/components/card-excerpt";
import { useCardPages } from "@/api/card-pages";
import { CardListViewport } from "@/components/card-list-viewport";
import { BalancedCardGrid } from "@/components/balanced-card-grid";
import { EntityDetailPage } from "./entity-detail-page";
import { DetailNavigation } from "@/components/detail-layout/detail-navigation";
import { openCardLink } from "@/routing/card-navigation";
import { useLocation, navigate, destination } from "@/routing/location";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { EntityFilter } from "@/components/entity-filter";
import { ArrowUpRight } from "lucide-react";
import { useEntity } from "@/api/context";
import type { Agent } from "@/api/types";
import { useUi } from "@/state/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import {
  Choice,
  Search,
  QueryState,
  NoData,
  TextBlock,
  formatDate,
} from "@/components/shared";
import { ProfileForm } from "./profile-form";
export function Agents() {
  useLocale();
  const [name, setName] = useUrlState<string>("agents.name", ""),
    [rawRole, setRole] = useUrlState<string>("agents.role", "", {
      values: ["", "leader", "worker", "collaborator"],
    }),
    [teamId, setTeam] = useUrlState<string>("agents.teamId", ""),
    [archived, setArchived] = useUrlState<string>(
      "agents.archived",
      "false",
      {
        values: booleanValues,
      },
    ),
    [offset, setOffset] = useUrlState<number>("agents.offset", 0);
  // Keep old bookmarked URLs readable without resetting pagination or history.
  const role = rawRole === "collaborator" ? "worker" : rawRole;
  const limit = usePageSize("agents", 12);
  const q = useCardPages("agents", {
    name: name || undefined,
    teamId: teamId || undefined,
    role: (role as "leader" | "worker") || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit,
    sortBy: "name",
  });
  return (
    <>
      <header className="page-heading listing-heading">
        <div className="sr-only">
          <h1>{tr("common.agents")}</h1>
          <p>
            {tr("agents.profilesInstructionsAndContextToPickUpWhereYouLeft")}
          </p>
        </div>
        <FilterBar
          inHeader
          search={
            <>
              <Search
                label={tr("agents.searchAgents")}
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
            label={tr("agents.team")}
            value={teamId}
            onChange={(v) => {
              setTeam(v);
              setOffset(0);
            }}
          />
          <Choice
            label={tr("agents.role")}
            value={role}
            onChange={(v) => {
              setRole(v);
              setOffset(0);
            }}
            options={[
              { value: "leader", label: tr("common.leader") },
              { value: "worker", label: tr("common.worker") },
            ]}
            all={tr("common.all")}
          />
          <Choice
            label={tr("agents.registry")}
            value={archived}
            onChange={(v) => {
              setArchived(v);
              setOffset(0);
            }}
            options={[
              { value: "false", label: tr("agents.active") },
              { value: "true", label: tr("agents.archived") },
            ]}
          />
        </FilterBar>
      </header>
      <CardListViewport
        key={q.identity}
        state={q}
        label={tr("agents.agentList")}
      >
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
                        <SystemBadge system={a.system} />
                      </CardHeader>
                      <CardContent>
                        <CardExcerpt text={a.roleDescription} />
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {a.bindings.leaderTeamId && (
                            <AgentRoleSymbol
                              teamId={a.bindings.leaderTeamId}
                              role="leader"
                            />
                          )}
                          {a.bindings.workerTeamId && (
                            <AgentRoleSymbol
                              teamId={a.bindings.workerTeamId}
                              role="worker"
                            />
                          )}
                          {!a.bindings.leaderTeamId &&
                            !a.bindings.workerTeamId && (
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
                    ? tr("agents.noAgentsMatchTheFilters")
                    : tr("agents.noAgentsInThisRegistry")
                }
                description={tr("agents.adjustTheFiltersToBrowseOtherAgents")}
              />
            )}
          </>
        )}
      </CardListViewport>
    </>
  );
}
export function AgentPage() {
  useLocale();
  const id = useUi((s) => s.agentId);
  return id ? <AgentDetail key={id} id={id} /> : null;
}
function AgentDetail({ id }: { id: string }) {
  useLocale();
  const q = useEntity("agents", id);
  const [tab, setTab] = useUrlState<string>("agent.tab", "profile", {
    values: ["profile", "activities", "chats"],
  });
  const configuring = useLocation().split("?")[0].endsWith("/settings");
  return (
    <EntityDetailPage
      label={tr("agents.agent")}
      title={q.data?.name ?? tr("agents.agentProfile")}
      description={
        <TextBlock>
          {q.data?.roleDescription ?? tr("agents.recordedProfileAndContext")}
        </TextBlock>
      }
      overlays={
        q.data && (
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
                  {tr("agents.agentProfileSettings")}
                </DialogDescription>
              </DialogHeader>
              <ProfileForm key={q.data.id} agent={q.data} />
            </DialogContent>
          </Dialog>
        )
      }
      viewKey="agent.view"
      contextLabel={tr("agents.details")}
      backLabel={tr("agents.backToAgent")}
      avatar={q.data && <AgentAvatar agent={q.data} />}
      context={
        q.data && (
          <>
            <>
              <div>
                <Badge variant="secondary">
                  {q.data.archivedAt
                    ? tr("common.archived")
                    : tr("agents.activeProfile")}
                </Badge>
                <SystemBadge system={q.data.system} />
                <p className="small-note">
                  {tr("agents.lastUpdated")} {formatDate(q.data.updatedAt)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/agents/${q.data.slug}/settings${location.search}`,
                  )
                }
              >
                {tr("agents.configure")}
              </Button>
            </>

            <section>
              <h2>{tr("agents.associations")}</h2>
              {q.data.bindings.leaderTeamId && (
                <TeamLink id={q.data.bindings.leaderTeamId} role="leader" />
              )}
              {q.data.bindings.workerTeamId && (
                <TeamLink id={q.data.bindings.workerTeamId} role="worker" />
              )}
              {!q.data.bindings.leaderTeamId &&
                !q.data.bindings.workerTeamId && (
                  <p className="small-note">
                    {tr("agents.noCurrentAssociations")}
                  </p>
                )}
            </section>
          </>
        )
      }
    >
      <QueryState query={q}>
        {q.data && (
          <>
            <Tabs value={tab} onValueChange={setTab}>
              <DetailNavigation
                value={tab}
                ariaLabel={tr("agents.details")}
                previousLabel={tr("tasks.showPreviousTabs")}
                nextLabel={tr("tasks.showNextTabs")}
                items={[
                  ["profile", tr("agents.profile")],
                  ["activities", tr("agents.tasks")],
                  ["chats", tr("agents.chats")],
                ]}
              />
              <TabsContent value="profile">
                <Profile agent={q.data} />
              </TabsContent>
              <TabsContent value="activities">
                <Activities agentId={id} />
              </TabsContent>
              <TabsContent value="chats">
                <AgentManagedDetails agentId={id} />
                <AgentChats agentId={id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </QueryState>
    </EntityDetailPage>
  );
}
function Profile({ agent }: { agent: Agent }) {
  useLocale();
  return (
    <div className="detail-section">
      <AgentLatestActivity agentId={agent.id} />
      <h3>{tr("agents.workingStyle")}</h3>
      <TextBlock>{agent.workStyle}</TextBlock>
      <h3>{tr("agents.instructions")}</h3>
      <TextBlock>{agent.workInstructions}</TextBlock>
      <h3>{tr("agents.rules")}</h3>
      <TextBlock>{agent.rules.join("\n")}</TextBlock>
      <h3>{tr("agents.accessLimits")}</h3>
      <TextBlock>{agent.accessLimits.join("\n")}</TextBlock>
      <p className="small-note">
        {tr("agents.actualPermissionsBelongToTheHarness")}
      </p>
      <h3>{tr("agents.briefContext")}</h3>
      <TextBlock>{agent.contextSummary}</TextBlock>
    </div>
  );
}
function TeamLink({ id, role }: { id: string; role: TeamRole }) {
  useLocale();
  const q = useEntity("teams", id),
    open = useUi((s) => s.openTeam);
  return (
    <Button variant="outline" onClick={() => open(id)}>
      <TeamRoleIcon id={roleIconId(q.data, role)} />
      {tr(`common.${role}`)} · {q.data?.name ?? tr("agents.team")}
      <ArrowUpRight data-icon="inline-end" />
    </Button>
  );
}
function Activities({ agentId }: { agentId: string }) {
  useLocale();
  const [relation, setRelation] = useUrlState<string>(
      "activities.relation",
      "any",
      { values: ["any", "authored", "executing", "worked"] },
    ),
    [title, setTitle] = useUrlState<string>("activities.title", "");
  const limit = usePageSize("activities", 10);
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
              }}
              label={tr("agents.searchAgentTasks")}
            />
          </>
        }
        active={!!(title || relation !== "any")}
        onClear={() => {
          setTitle("");
          setRelation("any");
        }}
      >
        <Choice
          label={tr("agents.relationship")}
          value={relation}
          onChange={(v) => {
            setRelation(v);
          }}
          options={[
            { value: "any", label: tr("agents.all") },
            { value: "authored", label: tr("agents.authorship") },
            { value: "executing", label: tr("agents.currentExecutor") },
            { value: "worked", label: tr("agents.withOwnSummary") },
          ]}
        />
      </FilterBar>
      <DetailRecordList
        resource="activities"
        scope={agentId}
        filters={{
          relation: relation as "any" | "authored" | "executing" | "worked",
          title: title || undefined,
          limit,
          sortBy: "taskUpdatedAt",
          sortOrder: "desc",
        }}
        empty={tr("agents.noTasksMatchTheFilters")}
        emptyDescription={tr(
          "agents.adjustTheSearchOrRelationshipWithThisAgent",
        )}
        countLabel={tr("agents.tasks")}
      >
        {(a) => (
          <article className="record" key={a.taskId}>
            <button className="record-link" onClick={() => open(a.taskId)}>
              {a.title}
            </button>
            <div className="flex gap-2">
              <Badge variant="outline">
                {a.isCurrentExecutor
                  ? tr("agents.currentExecutor")
                  : tr("agents.historyPreserved")}
              </Badge>
              <span className="small-note">
                {formatDate(a.taskUpdatedAt)}
              </span>
            </div>
          </article>
        )}
      </DetailRecordList>
    </div>
  );
}
