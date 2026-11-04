import { useEntity } from "@/api/context";
import type { Team } from "@/api/types";
import type { TeamRoleIconId } from "@/api/generated/ra/TeamRoleIconId";
import catalog from "../../../docs/team-role-icons.json";
import { useLocale, t as tr } from "@/i18n";
import { Field, FieldLabel } from "./ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Tooltip } from "radix-ui";

export const teamRoleIcons = catalog;
export type TeamRole = "leader" | "collaborator";
export function roleIconId(
  team: Team | undefined,
  role: TeamRole,
): TeamRoleIconId {
  return (
    (role === "leader" ? team?.leaderIconId : team?.collaboratorIconId) ??
    (role === "leader" ? "crown" : "user-round")
  );
}

export function TeamRoleIcon({ id }: { id: string }) {
  const icon = catalog.find((entry) => entry.id === id);
  // Only bundled catalog markup is rendered. Never inject response/user SVG.
  return icon ? (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 [&>svg]:size-4"
      data-role-icon={icon.id}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  ) : null;
}

export function AgentRoleSymbol({
  teamId,
  role,
}: {
  teamId: string;
  role: TeamRole;
}) {
  useLocale();
  const team = useEntity("teams", teamId);
  const label = tr(`common.${role}`);
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            className="card-symbol"
            role="img"
            aria-label={label}
          >
            <TeamRoleIcon id={roleIconId(team.data, role)} />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function RoleIconSelect({
  role,
  value,
  onChange,
}: {
  role: TeamRole;
  value: TeamRoleIconId;
  onChange: (value: TeamRoleIconId) => void;
}) {
  useLocale();
  const label = tr(
    role === "leader" ? "teams.leaderIcon" : "teams.collaboratorIcon",
  );
  return (
    <Field>
      <FieldLabel htmlFor={`team-${role}-icon`}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(id) => onChange(id as TeamRoleIconId)}
      >
        <SelectTrigger id={`team-${role}-icon`} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-[min(20rem,var(--radix-select-content-available-height))]"
        >
          {catalog.map((icon) => (
            <SelectItem key={icon.id} value={icon.id}>
              <TeamRoleIcon id={icon.id} />
              {tr(`teams.icons.${icon.id}`)} <span>{icon.unicode}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
