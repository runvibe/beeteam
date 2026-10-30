import { Columns3, UserRound, UsersRound } from "lucide-react";
import "./card-kind-mark.css";
const icons = { board: Columns3, agent: UserRound, team: UsersRound };
export function CardKindMark({ kind }: { kind: keyof typeof icons }) {
  const Icon = icons[kind];
  return (
    <span className="card-kind-mark" data-kind={kind} aria-hidden="true">
      <Icon
        fill="currentColor"
        stroke={kind === "board" ? "var(--card)" : "currentColor"}
        strokeWidth={1.5}
      />
    </span>
  );
}
