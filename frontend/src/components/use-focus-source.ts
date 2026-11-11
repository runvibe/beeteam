import { useEffect } from "react";

const TEXT_ENTRY = [
  "input:not([type=button]):not([type=checkbox]):not([type=color]):not([type=file]):not([type=image]):not([type=radio]):not([type=range]):not([type=reset]):not([type=submit])",
  "textarea",
  "[contenteditable]:not([contenteditable=false])",
].join(",");

export function useFocusSource() {
  useEffect(() => {
    const root = document.documentElement;
    let keyboardPending = false;
    const pointer = () => {
      keyboardPending = false;
      root.dataset.focusSource = "pointer";
    };
    const keyboard = (event: KeyboardEvent) => {
      // Typing keeps pointer focus; a subsequent keyboard-driven focus move does not.
      keyboardPending = true;
      const target = event.target;
      if (
        event.key === "Tab" ||
        !(target instanceof Element && target.closest(TEXT_ENTRY))
      ) {
        root.dataset.focusSource = "keyboard";
      }
    };
    const focus = () => {
      if (keyboardPending) root.dataset.focusSource = "keyboard";
      keyboardPending = false;
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", focus, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", focus, true);
      delete root.dataset.focusSource;
    };
  }, []);
}
