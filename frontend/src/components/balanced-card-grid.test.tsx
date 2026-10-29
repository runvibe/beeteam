import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BalancedCardGrid } from "./balanced-card-grid";

it.each([
  [1, 280],
  [2, 574],
  [3, 868],
  [4, 574],
  [5, 868],
  [9, 868],
  [25, 1456],
])(
  "bounds %i cards to a balanced block of %ipx without changing their reading order",
  (count, width) => {
    const { container } = render(
      <BalancedCardGrid className="board-grid">
        {Array.from({ length: count }, (_, index) => (
          <article key={index}>Card {index + 1}</article>
        ))}
      </BalancedCardGrid>,
    );
    expect(container.querySelector(".balanced-card-grid")).toHaveStyle({
      "--grid-width": `${width}px`,
    });
    expect(
      screen.getAllByRole("article").map((card) => card.textContent),
    ).toEqual(Array.from({ length: count }, (_, index) => `Card ${index + 1}`));
  },
);

it("switches from a centered block to full-width rows at horizontal capacity", () => {
  const measure = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      width: 1000,
      height: 100,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 100,
      toJSON: () => ({}),
    });
  try {
    const cards = (count: number) => (
      <BalancedCardGrid className="agent-grid">
        {Array.from({ length: count }, (_, index) => (
          <article key={index}>Card {index + 1}</article>
        ))}
      </BalancedCardGrid>
    );
    const { container, rerender } = render(cards(4));
    const grid = container.querySelector(".balanced-card-grid");
    expect(grid).toHaveAttribute("data-saturated", "false");
    rerender(cards(5));
    expect(grid).toHaveAttribute("data-saturated", "true");
    expect(grid).toHaveStyle({ "--grid-columns": "3" });
    rerender(cards(4));
    expect(grid).toHaveAttribute("data-saturated", "false");
  } finally {
    measure.mockRestore();
  }
});
