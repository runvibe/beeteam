import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids } from "@/api/seed";
import { App } from "@/App";
import { TaskDescription, TaskCurrentSummary } from "./task-header-content";
import { TaskOverview } from "./task-detail-layout";
import { TaskCompactHeader } from "./task-scroll-header";
import { readFileSync } from "node:fs";
const detailCss = readFileSync("src/features/task-detail.css", "utf8");

it.each(["attachments", "plans", "overview"])(
  "renders descriptive Markdown in %s while retaining literal metadata",
  async (tab) => {
    const seed = makeSeed();
    seed.attachments[0].description = "**Descrição formatada**";
    seed.attachments[0].originalName = "**arquivo**.txt";
    seed.plans[0].changeSummary = "**Alteração formatada**";
    seed.tasks[0].block = {
      ...seed.tasks[0].block,
      blocked: true,
      reason: "**Motivo formatado**",
    };
    window.history.replaceState({}, "", `/tasks/${ids.task}?tab=${tab}`);
    render(
      <ApiProvider api={createMockApi({ delay: 0, seed })}>
        <App />
      </ApiProvider>,
    );
    const text =
      tab === "attachments"
        ? "Descrição formatada"
        : tab === "plans"
          ? "Alteração formatada"
          : "Motivo formatado";
    expect(
      (await screen.findAllByText(text)).every(
        (node) => node.tagName === "STRONG",
      ),
    ).toBe(true);
    if (tab === "attachments")
      expect(
        screen.getByRole("heading", { name: "**arquivo**.txt" }),
      ).toBeVisible();
  },
);

it("renders all overview prose as safe Markdown with nested document headings", () => {
  const task = makeSeed().tasks[0];
  task.currentSummary = "# Resultado\n\n**Validado**\n\n- Um\n- Dois";
  task.description =
    "Primeiro parágrafo.\n\nSegundo parágrafo.\n\n| A | B |\n|---|---|\n| C | D |";
  task.progress.note =
    "```js\nconst n = 1\n```\n\n[Seguro](https://example.com)\n\n[Ruim](javascript:alert%281%29)\n\n<script>alert(1)</script>";
  const { container } = render(
    <>
      <TaskDescription task={task} />
      <TaskCurrentSummary task={task} />
      <TaskOverview task={task} />
    </>,
  );
  expect(
    screen.getByRole("heading", { name: "Resultado", level: 3 }),
  ).toBeVisible();
  expect(screen.getByText("Validado").tagName).toBe("STRONG");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("table")).toBeVisible();
  expect(container.querySelector("pre code")).toHaveTextContent("const n = 1");
  expect(screen.getByRole("link", { name: "Seguro" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.queryByRole("link", { name: "Ruim" })).toBeNull();
  expect(container.querySelector("script")).toBeNull();
});

it("renders a noninteractive clipped Markdown echo for a blocked task", () => {
  const task = makeSeed().tasks[0];
  task.block = {
    ...task.block,
    blocked: true,
    reason: "**Aguardar** [revisão](https://example.com)",
  };
  const { container } = render(<TaskCompactHeader task={task} visible />);
  expect(container.querySelector("strong")?.textContent).toBe("Task bloqueada");
  expect(
    container.querySelector(".task-compact-reason strong"),
  ).toHaveTextContent("Aguardar");
  expect(container.querySelector(".task-compact-reason")).toHaveAttribute(
    "inert",
  );
});

it.each([
  ["light", "#181818", "#eeeeee", "rgb(24, 24, 24)"],
  ["dark", "#eeeeee", "#262626", "rgb(238, 238, 238)"],
])(
  "keeps code and quotes readable inside the red blocked alert in %s theme",
  (_theme, foreground, muted, expected) => {
    const style = document.createElement("style");
    style.textContent =
      `:root { --foreground: ${foreground}; --muted: ${muted}; } .markdown-content pre { background: var(--muted); } .markdown-content blockquote { color: #888888; }` +
      detailCss
        .slice(
          detailCss.indexOf(".task-blocked-message .markdown-content a,"),
          detailCss.indexOf(".task-plan-navigation {"),
        )
        .replaceAll("var(--foreground)", foreground)
        .replaceAll("var(--muted)", muted);
    document.head.append(style);
    try {
      const { container } = render(
        <div className="task-blocked-message" style={{ color: "white" }}>
          <div className="markdown-content">
            <pre>code</pre>
            <blockquote>quote</blockquote>
          </div>
        </div>,
      );
      expect(getComputedStyle(container.querySelector("pre")!).color).toBe(
        expected,
      );
      expect(
        getComputedStyle(container.querySelector("blockquote")!).color,
      ).toBe("rgb(255, 255, 255)");
    } finally {
      style.remove();
    }
  },
);

it("renders historical summaries and pending prose without interpreting deliverable labels", async () => {
  const seed = makeSeed();
  seed.summaries[0].summary = "**Resumo histórico**\n\n- Evidência";
  seed.summaries[0].pending = ["Revisar **contraste**"];
  seed.summaries[0].deliverables[0].label = "**Nome literal**";
  window.history.replaceState({}, "", `/tasks/${ids.task}?tab=summaries`);
  render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <App />
    </ApiProvider>,
  );
  expect((await screen.findByText("Resumo histórico")).tagName).toBe("STRONG");
  expect(
    within(screen.getByRole("region", { name: "Pendências" })).getByText(
      "contraste",
    ).tagName,
  ).toBe("STRONG");
  expect(screen.getByText("**Nome literal**")).toBeVisible();
});
