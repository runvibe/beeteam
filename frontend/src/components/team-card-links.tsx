import { Crown, UserRound } from "lucide-react";
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
  const leader = useEntity("agents", team.leaderId || "");
  const countLabel = `${team.collaboratorCount} ${team.collaboratorCount === 1 ? "colaborador" : "colaboradores"} do time ${team.name}`;
  return (
    <Tooltip.Provider delayDuration={200}>
      {leader.data?.slug ? (
        <Shortcut
          href={destination(`/agents/${leader.data.slug}`)}
          label={`Abrir liderança: ${leader.data.name}`}
        >
          <Crown fill="currentColor" aria-hidden="true" />
        </Shortcut>
      ) : (
        <span
          className="team-card-shortcut"
          role="img"
          aria-label={
            team.leaderId ? "Liderança indisponível" : "Sem liderança"
          }
        >
          <Crown aria-hidden="true" />
        </span>
      )}
      <Shortcut
        href={`${destination("/agents")}&${new URLSearchParams({ "agents.teamId": team.id, "agents.role": "collaborator" })}`}
        label={countLabel}
      >
        <UserRound fill="currentColor" aria-hidden="true" />
        <span aria-hidden="true">{team.collaboratorCount}</span>
      </Shortcut>
    </Tooltip.Provider>
  );
}
