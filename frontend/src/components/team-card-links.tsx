import { formatNumber, useLocale, t as tr } from "@/i18n";

import { TeamRoleIcon, roleIconId } from "./team-role-icon";
import { Tooltip } from "radix-ui";
import { useEntity } from "@/api/context";
import type { Team } from "@/api/types";
import { destination } from "@/routing/location";
import { openCardLink } from "@/routing/card-navigation";
import type { ReactNode } from "react";

function Shortcut({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  useLocale();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          className="team-card-shortcut"
          href={href}
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation();
            openCardLink(event);
          }}
        >
          {children}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export function TeamCardLinks({ team }: { team: Team }) {
  useLocale();
  const leader = useEntity("agents", team.leaderId || "");
  const countLabel = tr("teams.workers", {
    count: team.workerCount,
    name: team.name,
  });
  return (
    <Tooltip.Provider delayDuration={200}>
      {leader.data?.slug ? (
        <Shortcut
          href={destination(`/agents/${leader.data.slug}`)}
          label={tr("teams.openLeader", { name: leader.data.name })}
        >
          <TeamRoleIcon id={roleIconId(team, "leader")} />
        </Shortcut>
      ) : (
        <span
          className="team-card-shortcut"
          role="img"
          aria-label={
            team.leaderId
              ? tr("teams.leadershipUnavailable")
              : tr("teams.noLeader")
          }
        >
          <TeamRoleIcon id={roleIconId(team, "leader")} />
        </span>
      )}
      <Shortcut
        href={`${destination("/agents")}&${new URLSearchParams({ "agents.teamId": team.id, "agents.role": "worker" })}`}
        label={countLabel}
      >
        <TeamRoleIcon id={roleIconId(team, "worker")} />
        <span aria-hidden="true">{formatNumber(team.workerCount)}</span>
      </Shortcut>
    </Tooltip.Provider>
  );
}
