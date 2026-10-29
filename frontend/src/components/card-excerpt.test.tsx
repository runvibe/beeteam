import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardExcerpt } from "./card-excerpt";

it("fades only measured overflow and retains the complete accessible text", () => {
  const height = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(88);
  const scroll = vi
    .spyOn(HTMLElement.prototype, "scrollHeight", "get")
    .mockReturnValue(200);
  try {
    const text = "Descrição integral ".repeat(100);
    const { container, rerender } = render(<CardExcerpt text={text} />);
    expect(container.firstChild).toHaveAttribute("data-overflow", "true");
    expect(container.textContent).toBe(text);
    scroll.mockReturnValue(22);
    rerender(<CardExcerpt text="Curta" />);
    expect(container.firstChild).toHaveAttribute("data-overflow", "false");
    scroll.mockReturnValue(0);
    rerender(<CardExcerpt text="" />);
    expect(container.firstChild).toHaveAttribute("data-overflow", "false");
  } finally {
    height.mockRestore();
    scroll.mockRestore();
  }
});
