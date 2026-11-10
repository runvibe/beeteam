import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { setLocalePreference } from "@/i18n";
import { SystemBadge } from "./system-badge";

it("labels only system resources", () => {
  setLocalePreference("pt");
  const view = render(<SystemBadge system />);
  expect(screen.getByText("Sistema")).toHaveAttribute("title", expect.stringContaining("Bee Team"));
  view.rerender(<SystemBadge system={false} />);
  expect(screen.queryByText("Sistema")).toBeNull();
});
