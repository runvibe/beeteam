import { fireEvent } from "@testing-library/react";

export function editPlainText(element: HTMLElement, value: string) {
  element.textContent = value;
  if (value.endsWith("\n"))
    element.append(document.createTextNode("\n"));
  fireEvent.input(element);
}
