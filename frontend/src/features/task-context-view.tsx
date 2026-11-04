import { useLocale, t as tr } from "@/i18n";
import { useLocation } from "@/routing/location";
import { isTaskDetailsView, openTaskDetails } from "@/routing/task-details-view";
import { HeaderFilters } from "@/components/header-filters";
import { DetailInfoButton } from "@/components/detail-layout/detail-info-button";
import { useDetailMobile } from "@/components/detail-layout/use-detail-mobile";
export { useDetailMobile as useTaskMobile } from "@/components/detail-layout/use-detail-mobile";
export function useTaskContextView(){const mobile=useDetailMobile();return isTaskDetailsView(useLocation())&&mobile;}
export function TaskInfoButton(){useLocale();const screen=useTaskContextView(),mobile=useDetailMobile();return <HeaderFilters enabled><DetailInfoButton label={tr("tasks.taskDetails")} screen={screen} mobile={mobile} onOpen={openTaskDetails}/></HeaderFilters>;}
