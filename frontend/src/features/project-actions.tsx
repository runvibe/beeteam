import { useRef, useState } from "react";
import { CodeXml, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/api/context";
import type { ProjectApplication } from "@/api/local-projects";

export function TaskProjectActions({
  taskId,
  projectKey,
  projectName,
}: {
  taskId: string;
  projectKey: string;
  projectName: string;
}) {
  const api = useApi();
  return (
    <ProjectActions
      projectName={projectName}
      onOpen={async (application) => {
        await api.openProject(taskId, projectKey, application);
      }}
    />
  );
}

/** The caller supplies the real transport; rendering never opens an application. */
export function ProjectActions({
  projectName,
  onOpen,
}: {
  projectName: string;
  onOpen: (application: ProjectApplication) => Promise<void>;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState<ProjectApplication | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const open = async (application: ProjectApplication) => {
    if (busy.current) return;
    busy.current = true;
    setPending(application);
    setError("");
    setNotice("");
    try {
      await onOpen(application);
      setNotice(
        `Solicitação enviada ao ${application === "explorer" ? "Explorer" : "VS Code"}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir a pasta neste aplicativo.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <div
      role="group"
      aria-label={`Ações do projeto ${projectName}`}
      className="project-actions"
      aria-busy={pending !== null}
    >
      <div className="project-action-buttons">
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => void open("explorer")}
        >
          <FolderOpen aria-hidden="true" />
          {pending === "explorer" ? "Abrindo Explorer…" : "Abrir no Explorer"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => void open("vscode")}
        >
          <CodeXml aria-hidden="true" />
          {pending === "vscode" ? "Abrindo VS Code…" : "Abrir no VS Code"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="small-note">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="small-note">
          {notice}
        </p>
      )}
    </div>
  );
}
