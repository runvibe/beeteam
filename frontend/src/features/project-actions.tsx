import { LocalizedError, message, useLocale, t as tr } from "@/i18n";

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
  useLocale();
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
  useLocale();
  const busy = useRef(false);
  const [pending, setPending] = useState<ProjectApplication | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const open = async (application: ProjectApplication) => {
    if (busy.current) return;
    busy.current = true;
    setPending(application);
    setError(null);
    try {
      await onOpen(application);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new LocalizedError(
              message("common.couldNotOpenTheFolderInThisApplication"),
            ),
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <div
      role="group"
      aria-label={tr("tasks.projectActions", { name: projectName })}
      className="project-actions"
      aria-busy={pending !== null}
    >
      <div className="project-action-buttons">
        <Button
          variant="outline"
          size="icon"
          disabled={pending !== null}
          aria-label={tr("common.openInExplorer")}
          title={tr("common.openInExplorer")}
          onClick={() => void open("explorer")}
        >
          <FolderOpen aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={pending !== null}
          aria-label={tr("common.openInVsCode")}
          title={tr("common.openInVsCode")}
          onClick={() => void open("vscode")}
        >
          <img src={vscodeIcon} alt="" aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="small-note">
          {error.message}
        </p>
      )}
    </div>
  );
}
