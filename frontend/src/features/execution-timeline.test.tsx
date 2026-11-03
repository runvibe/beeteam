import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ExecutionTimeline } from "./execution-timeline";
it("keeps an empty timeline without inventing lifecycle points", () => {
  const { container } = render(
    <ExecutionTimeline events={[]} renderDetail={() => null} />,
  );
  expect(
    screen.getByText("Nenhuma transição de execução registrada."),
  ).toBeVisible();
  expect(
    container.querySelector(".execution-timeline-plot"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});
it("opens explicit events with keyboard, mouse and touch while preserving equal timestamp events", async () => {
  const user = userEvent.setup();
  const events = [
    { id: "start", label: "Início", occurredAt: "2026-11-03T12:00:00Z" },
    { id: "pause", label: "Pausa", occurredAt: "2026-11-03T12:00:00Z" },
  ];
  render(
    <ExecutionTimeline
      events={events}
      renderDetail={(event) => <p>Resumo {event.id}</p>}
    />,
  );
  await user.tab();
  expect(
    within(screen.getByRole("dialog")).getByText("Resumo start"),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  const pause = screen.getByRole("button", { name: /Pausa/ });
  await user.hover(pause);
  expect(
    within(screen.getByRole("dialog")).getByText("Resumo pause"),
  ).toBeVisible();
  await user.unhover(pause);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.pointer([
    { keys: "[TouchA>]", target: pause },
    { keys: "[/TouchA]", target: pause },
  ]);
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /Início|Pausa/ })).toHaveLength(
    2,
  );
  await user.click(
    screen.getByRole("button", { name: "Fechar detalhes do ponto" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
