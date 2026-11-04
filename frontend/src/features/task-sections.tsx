import { useLocale, t as tr } from "@/i18n";
import { DetailNavigation } from "@/components/detail-layout/detail-navigation";
import { TaskFilterSlot } from "./task-filter-layout";
const sections = () =>
  [
    ["overview", tr("tasks.overview")],
    ["specification", tr("tasks.specification")],
    ["plans", tr("tasks.plans")],
    ["children", tr("tasks.subtasksTab")],
    ["comments", tr("tasks.conversation")],
    ["summaries", tr("tasks.summariesTitle")],
    ["attachments", tr("tasks.files")],
    ["timeline", tr("tasks.timeline")],
  ] as const;

export function TaskSections({ value }: { value: string }) {
  useLocale();
  return (
    <DetailNavigation
      value={value}
      items={sections()}
      ariaLabel={tr("tasks.taskSection")}
      previousLabel={tr("tasks.showPreviousTabs")}
      nextLabel={tr("tasks.showNextTabs")}
      heightProperty="--task-sections-height"
      filterSlot={<TaskFilterSlot />}
    />
  );
}
