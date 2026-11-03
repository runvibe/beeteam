import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { IntervalMetrics } from "./interval-metrics";
it("separates authoritative complete and partial totals, duration semantics and missing coverage", () => {
  const { rerender } = render(<IntervalMetrics />);
  expect(screen.getAllByRole("img", {name: "Não informado"})).toHaveLength(4);
  expect(screen.queryByText("0")).toBeNull();
  rerender(
    <IntervalMetrics
      data={{
        tokens: "9007199254740993",
        partialTokens: "0",
        observedMs: "120000",
        elapsedMs: "90000",
        coverage: [
          { label: "Abertos", count: 2 },
          { label: "Incompletos", count: 1 },
        ],
      }}
    />,
  );
  expect(screen.getByText("9.007.199.254.740.993")).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
  expect(screen.getByText("2 min")).toBeVisible();
  expect(screen.getByText("1 min 30 s")).toBeVisible();
  expect(screen.getByText(/Abertos/)).toBeVisible();
  expect(screen.getByText(/Incompletos/)).toBeVisible();
  expect(screen.queryByText(/não representam tempo de CPU/)).toBeNull();
});
