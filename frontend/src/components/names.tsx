import { useEntity } from "@/api/context";
import { useUi } from "@/state/ui";
import { Button } from "./ui/button";
export function AgentName({ id }: { id: string | null }) {
  const q = useEntity("agents", id ?? "");
  const open = useUi((s) => s.openAgent);
  return id ? (
    <Button
      variant="link"
      size="sm"
      className="max-w-full justify-start truncate p-0"
      onClick={() => open(id)}
    >
      {q.data?.name ?? (q.error ? "Agente indisponível" : "Carregando…")}
    </Button>
  ) : (
    <span>Usuário local</span>
  );
}
export function BoardName({ id }: { id: string }) {
  const q = useEntity("boards", id);
  return <span>{q.data?.name ?? "Board"}</span>;
}
