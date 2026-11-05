import {
  TeamRoleIcon,
  RoleIconSelect,
  roleIconId,
} from "@/components/team-role-icon";
import { DetailRecordList } from "./detail-record-list";
import { useApiCompatibility } from "@/api/compatibility";
import { teamSettingsPatch } from "./team-settings-patch";
import { useLocale, t as tr } from "@/i18n";

import { CardKindMark } from "@/components/card-kind-mark";
import { TeamCardLinks } from "@/components/team-card-links";
import { CardExcerpt } from "@/components/card-excerpt";
import { useCardPages } from "@/api/card-pages";
import { CardListViewport } from "@/components/card-list-viewport";
import { BalancedCardGrid } from "@/components/balanced-card-grid";
import { ArrowUpRight } from "lucide-react";
import { useLocation, navigate, destination } from "@/routing/location";
import { openCardLink, openCardBody } from "@/routing/card-navigation";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { useApi, useEntity } from "@/api/context";
import type { Team } from "@/api/types";
import { useUi } from "@/state/ui";
import { EntityDetailPage } from "./entity-detail-page";
import { formatDate } from "@/components/shared";
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
  TextBlock,
} from "@/components/shared";
import { AgentName } from "@/components/names";
import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
export function Teams() {
  useLocale();
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
          <h1>{tr("common.teams")}</h1>
          <p>{tr("teams.oneLeaderPerTeamOneIdentityPerAgent")}</p>
        </div>
        <FilterBar
          inHeader
          search={
            <>
              <Search
                label={tr("teams.searchTeams")}
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
      <CardListViewport key={q.identity} state={q} label={tr("teams.teamList")}>
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
                    <CardKindMark kind="team" />
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
                    ? tr("teams.noTeamsMatchTheFilters")
                    : tr("teams.noTeamsInThisRegistry")
                }
                description={tr("teams.adjustFiltersToBrowseOtherTeams")}
              />
            )}
          </>
        )}
      </CardListViewport>
    </>
  );
}
export function TeamPage() {
  useLocale();
  const id = useUi((s) => s.teamId);
  return id ? <TeamDetail key={id} id={id} /> : null;
}
function TeamDetail({ id }: { id: string }) {
  useLocale();
  const configuring = useLocation().split("?")[0].endsWith("/settings");
  const q = useEntity("teams", id);
  const memberLimit = usePageSize("members", 10),
    boardLimit = usePageSize("managedBoards", 10);
  const openBoard = useUi((s) => s.openBoard);
  return (
    <EntityDetailPage
      label={tr("agents.team")}
      title={q.data?.name ?? tr("agents.team")}
      description={
        q.data ? (
          <TextBlock>{q.data.purpose}</TextBlock>
        ) : (
          tr(
            "teams.compositionAndManagedBoardsTasksRetainTheirAuthorAndExecutor",
          )
        )
      }
      viewKey="team.view"
      contextLabel={tr("teams.details")}
      backLabel={tr("teams.backToTeam")}
      context={
        q.data && (
          <>
            <section>
              <h2>{tr("tasks.record")}</h2>
              <dl>
                <div>
                  <dt>{tr("agents.registry")}</dt>
                  <dd>
                    {q.data.archivedAt
                      ? tr("common.archived")
                      : tr("agents.active")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("agents.lastUpdated")}</dt>
                  <dd>
                    <time dateTime={q.data.updatedAt}>
                      {formatDate(q.data.updatedAt)}
                    </time>
                  </dd>
                </div>
              </dl>
            </section>{" "}
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/teams/${q.data.slug}/settings${location.search}`)
              }
            >
              {tr("teams.editTeamMetadata")}
            </Button>
          </>
        )
      }
      overlays={
        q.data && (
          <Dialog
            open={configuring}
            onOpenChange={(v) =>
              !v && navigate(`/teams/${q.data.slug}${location.search}`, true)
            }
          >
            <DialogContent className="detail-dialog">
              <DialogHeader>
                <DialogTitle>
                  {tr("agents.configure")} {q.data.name}
                </DialogTitle>
                <DialogDescription>
                  {tr("teams.editTeamMetadata2")}
                </DialogDescription>
              </DialogHeader>
              <TeamForm key={q.data.id} team={q.data} />
            </DialogContent>
          </Dialog>
        )
      }
    >
      <QueryState query={q}>
        {q.data && (
          <>
            <div className="team-intro">
              <TextBlock>{q.data.context}</TextBlock>
            </div>
            <h3>{tr("common.agents")}</h3>
            <DetailRecordList
              resource="members"
              scope={id}
              filters={{ limit: memberLimit, sortBy: "name" }}
              empty={tr("agents.noCurrentAssociations")}
              countLabel={tr("common.agents")}
            >
              {(m) => (
                <div key={m.agentId} className="record-row">
                  <AgentName id={m.agentId} />
                  <Badge variant="outline">
                    <TeamRoleIcon id={roleIconId(q.data, m.role)} />
                    {m.role === "leader"
                      ? tr("common.leader")
                      : tr("common.collaborator")}
                  </Badge>
                </div>
              )}
            </DetailRecordList>
            <h3>{tr("teams.managedBoards")}</h3>
            <DetailRecordList
              resource="boards"
              scope=""
              filters={{ teamId: id, limit: boardLimit }}
              empty={tr("teams.noLinkedBoards")}
              countLabel={tr("teams.managedBoards")}
            >
              {(b) => (
                <Button
                  key={b.id}
                  className="team-board-link"
                  variant="outline"
                  onClick={() => {
                    openBoard(b.id);
                  }}
                >
                  <span>{b.name}</span>
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              )}
            </DetailRecordList>
          </>
        )}
      </QueryState>
    </EntityDetailPage>
  );
}
export function TeamForm({ team: latest }: { team: Team }) {
  useLocale();
  const api = useApi();
  const compatibility = useApiCompatibility();
  const iconsSupported = compatibility.supports("teams.role-icons");
  const autosave = useSettingsAutosave({
    resource: "teams",
    load: () => api.get("teams", latest.id),
    latest,
    values: (team: Team) => ({
      name: team.name,
      purpose: team.purpose,
      context: team.context,
      leaderIconId: roleIconId(team, "leader"),
      collaboratorIconId: roleIconId(team, "collaborator"),
    }),
    save: (draft, version) =>
      api.patch(
        "teams",
        latest.id,
        teamSettingsPatch(draft, iconsSupported),
        version,
      ),
  });
  const { name, purpose, context } = autosave.draft;
  return (
    <form {...autosave.formProps} className="detail-section">
      <FieldGroup>
        <RoleIconSelect
          disabled={!iconsSupported}
          role="leader"
          value={autosave.draft.leaderIconId}
          onChange={(id) => autosave.change("leaderIconId", id, true)}
        />
        <RoleIconSelect
          disabled={!iconsSupported}
          role="collaborator"
          value={autosave.draft.collaboratorIconId}
          onChange={(id) => autosave.change("collaboratorIconId", id, true)}
        />
        {!iconsSupported && (
          <div>
            <p className="small-note" role="status">
              {tr(
                compatibility.status === "compatible"
                  ? "compatibility.iconsMissing"
                  : "compatibility.iconsUnverified",
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-disabled={compatibility.isFetching}
              onClick={() => {
                if (!compatibility.isFetching) void compatibility.refetch();
              }}
            >
              {tr("compatibility.retry")}
            </Button>
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="team-name">{tr("agents.name")}</FieldLabel>
          <Input
            id="team-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => autosave.change("name", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-purpose">{tr("teams.purpose")}</FieldLabel>
          <Textarea
            id="team-purpose"
            value={purpose}
            onChange={(e) => autosave.change("purpose", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-context">{tr("teams.context")}</FieldLabel>
          <Textarea
            id="team-context"
            value={context}
            onChange={(e) => autosave.change("context", e.target.value)}
          />
        </Field>
      </FieldGroup>
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          {tr("agents.thisRecordWasUpdatedInAnotherSessionYourDraftWas")}
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
