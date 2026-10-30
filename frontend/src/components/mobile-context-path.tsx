import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useEntity } from "@/api/context";
import { useUi } from "@/state/ui";
import { goBack, useLocation } from "@/routing/location";
import { Button } from "./ui/button";
import "./mobile-context-path.css";

export function MobileContextPath() {
  const { area, boardId, taskId, agentId, teamId } = useUi();
  const url = useLocation();
  const board = useEntity("boards", boardId ?? "");
  const task = useEntity("tasks", taskId ?? "");
  const agent = useEntity("agents", agentId ?? "");
  const team = useEntity("teams", teamId ?? "");
  const name = taskId
    ? task.data?.title
    : agentId
      ? agent.data?.name
      : teamId
        ? team.data?.name
        : boardId
          ? board.data?.name
          : { boards: "Boards", agents: "Agentes", teams: "Times" }[area];
  const fallback = task.data
    ? task.data.parentId
      ? `/tasks/${task.data.parentId}`
      : `/boards/${task.data.boardId}`
    : agentId
      ? "/agents"
      : teamId
        ? "/teams"
        : "/boards";
  return (
    <nav className="mobile-context-path" aria-label="Caminho compacto">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Voltar ao contexto anterior"
        onClick={() => goBack(fallback)}
      >
        …
      </Button>
      <BreadcrumbName key={url.split("?")[0]} text={name ?? "Carregando…"} />
    </nav>
  );
}

export function BreadcrumbName({ text }: { text: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  useLayoutEffect(() => {
    if (!frame.current || !name.current) return;
    const measure = () =>
      setDistance(
        Math.max(0, name.current!.scrollWidth - frame.current!.clientWidth),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    observer.observe(name.current);
    return () => observer.disconnect();
  }, [text]);
  return (
    <span
      ref={frame}
      className="breadcrumb-marquee"
      data-overflow={distance > 1}
      title={text}
      style={
        {
          "--breadcrumb-travel": `${-distance}px`,
          "--breadcrumb-duration": `${Math.max(6, distance / 24 + 3)}s`,
        } as CSSProperties
      }
    >
      <span ref={name} className="breadcrumb-name" aria-current="page">
        {text}
      </span>
    </span>
  );
}
