import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TaskProgress } from "./task-progress";
it.each([0, 45, 100])("reports recorded progress %s accessibly", (percent) => {
  render(<TaskProgress percent={percent} />);
  const bar = screen.getByRole("progressbar", { name: "Progresso registrado" });
  expect(bar).toHaveAttribute("aria-valuenow", String(percent));
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "100");
  expect(screen.getByText(`${percent}%`)).toBeVisible();
});
