import { useLocale, t as tr } from "@/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import { useLocation } from "@/routing/location";
import {
  isTaskDetailsView,
  openTaskDetails,
} from "@/routing/task-details-view";
import { HeaderFilters } from "@/components/header-filters";
import { Button } from "@/components/ui/button";
import "./task-context-view.css";
const query = "(max-width: 1055px)";
function subscribe(notify: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", notify);
  return () => media?.removeEventListener("change", notify);
}
const snapshot = () => window.matchMedia?.(query).matches ?? false;
export function useTaskMobile() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
export function useTaskContextView() {
  const mobile = useTaskMobile();
  return isTaskDetailsView(useLocation()) && mobile;
}
export function TaskInfoButton() {
  useLocale();
  const details = useTaskContextView();
  const trigger = useRef<HTMLButtonElement>(null);
  const previous = useRef(details);
  useEffect(() => {
    if (previous.current && !details && snapshot())
      trigger.current?.focus({ preventScroll: true });
    previous.current = details;
  }, [details]);
  return (
    <HeaderFilters enabled>
      <Button
        ref={trigger}
        className="task-info-button"
        variant="outline"
        size="icon"
        aria-label={tr("tasks.taskDetails")}
        title={tr("tasks.taskDetails")}
        hidden={details}
        onClick={openTaskDetails}
      >
        <Info aria-hidden="true" />
      </Button>
    </HeaderFilters>
  );
}
