import type { MouseEvent } from "react";
import { navigate } from "./location";
export function openCardBody(event: MouseEvent<HTMLElement>, href: string) {
  if (
    event.defaultPrevented ||
    (event.target as Element).closest(
      "a,button,input,select,textarea,summary,[role=button],[role=link],[contenteditable=true]",
    ) ||
    window.getSelection()?.toString()
  )
    return;
  if (event.ctrlKey || event.metaKey || event.shiftKey)
    window.open(href, "_blank", "noopener");
  else if (!event.altKey) navigate(href);
}
export function openCardLink(event: MouseEvent<HTMLAnchorElement>) {
  if (window.getSelection()?.toString()) {
    event.preventDefault();
    return;
  }
  if (
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    navigate(event.currentTarget.getAttribute("href")!);
  }
}
