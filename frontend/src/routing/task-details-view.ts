import {
  isDetailsView,
  mainDetailsUrl,
  openDetails,
  closeDetails,
} from "./details-view";
export const isTaskDetailsView = (url: string) =>
  isDetailsView(url, "task.view");
export const taskMainUrl = (url?: string) => mainDetailsUrl("task.view", url);
export const openTaskDetails = () => openDetails("task.view");
export const closeTaskDetails = () => closeDetails("task.view");
