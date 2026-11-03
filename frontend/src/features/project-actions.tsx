import { useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import vscodeIcon from "@/assets/vscode.svg";
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
  const open = async (application: ProjectApplication) => {
    if (busy.current) return;
    busy.current = true;
    setPending(application);
    setError("");
    try {
      await onOpen(application);
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
          size="icon"
          disabled={pending !== null}
          aria-label="Abrir no Explorer"
          title="Abrir no Explorer"
          onClick={() => void open("explorer")}
        >
          <FolderOpen aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={pending !== null}
          aria-label="Abrir no VS Code"
          title="Abrir no VS Code"
          onClick={() => void open("vscode")}
        >
          <img src={vscodeIcon} alt="" aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="small-note">
          {error}
        </p>
      )}
    </div>
  );
}
