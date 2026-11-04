import { useEntity } from "@/api/context";
import { QueryState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { openCardLink } from "@/routing/card-navigation";
import { destination } from "@/routing/location";

/** The managing team belongs to the current board, independently of task ancestry. */
export function TaskBoardTeam({ boardId }: { boardId: string }) {
  const board = useEntity("boards", boardId);
  const team = useEntity("teams", board.data?.teamId ?? "");
  return (
    <QueryState query={board}>
      <QueryState query={team}>
        {team.data && (
          <Button
            asChild
            variant="link"
            className="h-auto max-w-full justify-start whitespace-normal text-left [overflow-wrap:anywhere]"
          >
            <a href={destination(`/teams/${team.data.slug}`)} onClick={openCardLink}>
              {team.data.name}
            </a>
          </Button>
        )}
      </QueryState>
    </QueryState>
  );
}
