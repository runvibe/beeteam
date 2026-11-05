import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Markdown } from "./markdown";
import { themeController } from "@/state/theme-runtime";
import { setLocalePreference } from "@/i18n";
import userEvent from "@testing-library/user-event";

// jsdom cannot measure SVG text. Real Mermaid layout is covered in browser QA.
const engine = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: engine }));
const fence = (source: string) => `\`\`\`mermaid\n${source}\n\`\`\``;
beforeEach(() => {
  engine.initialize.mockReset();
  engine.render.mockReset().mockImplementation(async (id: string) => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 200 100"><text>Diagram</text></svg>`,
    bindFunctions: vi.fn(),
  }));
  themeController.store.getState().setPreference("light");
});

it("renders Mermaid as a static image and preserves other code and original source", async () => {
  const source = "flowchart TD\n A --> B";
  const view = render(
    <Markdown>{fence(source) + "\n\n```js\nconst x = 1\n```"}</Markdown>,
  );
  expect(
    await screen.findByRole("img", { name: "Diagrama Mermaid" }),
  ).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
  expect(
    view.container.querySelector("pre code.language-js"),
  ).toHaveTextContent("const x = 1");
  expect(view.container.querySelector("details code")).toHaveTextContent(
    "flowchart TD",
  );
  expect(engine.render.mock.calls[0][1]).toBe(source + "\n");
  expect(view.container.querySelector("pre figure")).toBeNull();
});

it("fits a diagram initially and lets keyboard users inspect its natural size", async () => {
  render(<Markdown>{fence("flowchart TD\n A --> B")}</Markdown>);
  await screen.findByRole("img");
  const toggle = screen.getByRole("button", { name: "Ampliar diagrama" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(toggle);
  expect(
    screen.getByRole("button", { name: "Ajustar à largura" }),
  ).toHaveAttribute("aria-pressed", "true");
});

it("isolates multiple diagrams and retains the image on an unchanged parent refresh", async () => {
  const content =
    fence("flowchart TD\n A --> B") +
    "\n\n" +
    fence("sequenceDiagram\n A->>B: Hello");
  const view = render(<Markdown>{content}</Markdown>);
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
  const first = screen.getAllByRole("img")[0];
  expect(new Set(engine.render.mock.calls.map(([id]) => id)).size).toBe(2);
  view.rerender(<Markdown>{content}</Markdown>);
  expect(screen.getAllByRole("img")[0]).toBe(first);
  expect(engine.render).toHaveBeenCalledTimes(2);
});

it("maximizes only the selected static image and restores keyboard focus after Escape or Close", async () => {
  const user = userEvent.setup();
  render(
    <Markdown>
      {[fence("graph LR\n A --> B"), fence("graph TD\n C --> D")].join("\n\n")}
    </Markdown>,
  );
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
  const images = screen.getAllByRole("img");
  const triggers = screen.getAllByRole("button", {
    name: "Maximizar diagrama",
  });
  for (const [index, trigger] of triggers.entries()) {
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", {
      name: "Diagrama Mermaid",
    });
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      images[index].getAttribute("src"),
    );
    expect(dialog.querySelector("svg:not(.lucide)")).toBeNull();
    if (index === 0) await user.keyboard("{Escape}");
    else
      await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  }
  expect(engine.render).toHaveBeenCalledTimes(2);
});

it("updates theme/content and localizes controls without replacing authored source", async () => {
  const view = render(<Markdown>{fence("flowchart TD\n A --> B")}</Markdown>);
  await screen.findByRole("img");
  act(() => {
    themeController.store.getState().setPreference("dark");
    setLocalePreference("en");
  });
  await waitFor(() =>
    expect(engine.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "dark" }),
    ),
  );
  expect(screen.getByText("Diagram source")).toBeVisible();
  view.rerender(<Markdown>{fence("flowchart TD\n B --> C")}</Markdown>);
  await waitFor(() =>
    expect(engine.render.mock.calls.at(-1)?.[1]).toContain("B --> C"),
  );
  await screen.findByRole("img", { name: "Mermaid diagram" });
});

it("returns focus to the owning figure if Escape closes fullscreen during a theme render", async () => {
  const user = userEvent.setup();
  const view = render(<Markdown>{fence("graph TD\n A --> B")}</Markdown>);
  await user.click(
    await screen.findByRole("button", { name: "Maximizar diagrama" }),
  );
  let reject!: (error: Error) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  act(() => themeController.store.getState().setPreference("dark"));
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(2));
  await user.keyboard("{Escape}");
  try {
    await waitFor(() =>
      expect(view.container.querySelector("figure")).toHaveFocus(),
    );
  } finally {
    await act(async () => reject(new Error("render unavailable")));
  }
});

it("falls back to literal source when rendering fails", async () => {
  engine.render.mockRejectedValue(
    new Error("Untrusted <script>parser error</script>"),
  );
  const view = render(<Markdown>{fence("invalid Mermaid")}</Markdown>);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Não foi possível renderizar"));
  expect(view.container.querySelector("details")).toHaveAttribute("open");
  expect(view.container.querySelector("code")).toHaveTextContent(
    "invalid Mermaid",
  );
  expect(view.container.querySelector("script")).toBeNull();
});

it("limits excessive source and diagram count before calling the engine", async () => {
  const view = render(<Markdown>{fence("a".repeat(16001))}</Markdown>);
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("limite"),
  );
  expect(engine.render).not.toHaveBeenCalled();
  view.rerender(
    <Markdown>
      {Array.from({ length: 9 }, () => fence("flowchart TD\n A --> B")).join(
        "\n\n",
      )}
    </Markdown>,
  );
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(8));
  expect(screen.getByRole("status")).toHaveTextContent("limite");
  expect(engine.render).toHaveBeenCalledTimes(8);
});

it.each([
  '%%{init: {"securityLevel":"loose","themeCSS":"@import url(https://evil.invalid)"}}%%\nflowchart TD\n A --> B',
  "---\nconfig:\n  securityLevel: loose\n---\nflowchart TD\n A --> B",
  'flowchart TD\n A["<img src=x onerror=alert(1)>"]',
  'flowchart TD\n A@{ img: "https://evil.invalid/image.png" }',
  "flowchart TD\n A --> B\n classDef evil fill:url(https://evil.invalid)",
  "flowchart TD\n A --> B\n classDef evil fill:u\\72l(https://evil.invalid)",
])(
  "rejects embedded resources/configuration before rendering: %s",
  async (source) => {
    const view = render(<Markdown>{fence(source)}</Markdown>);
    expect(screen.getByRole("status")).toHaveTextContent("não suportado");
    expect(engine.render).not.toHaveBeenCalled();
    expect(view.container.querySelector("code")?.textContent).toBe(
      source + "\n",
    );
  },
);

it("sanitizes generated SVG and never binds navigation or callback functions", async () => {
  const bind = vi.fn();
  engine.render.mockResolvedValue({
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><script>alert(1)</script><a href="https://evil.invalid"><text>link</text></a><image href="https://evil.invalid/x"/><foreignObject><div>html</div></foreignObject><text>Safe</text></svg>',
    bindFunctions: bind,
  });
  const view = render(<Markdown>{fence("flowchart TD\n A --> B")}</Markdown>);
  const image = await screen.findByRole("img");
  const svg = decodeURIComponent(
    image.getAttribute("src")!.split(",").slice(1).join(","),
  );
  expect(svg).not.toMatch(/<script|<a[ >]|<image|foreignObject|onload|href/);
  expect(view.container.querySelector("svg")).toBeNull();
  expect(bind).not.toHaveBeenCalled();
});

it("discards stale async results on content changes and removes temporary containers", async () => {
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<Markdown>{fence("flowchart TD\n OLD --> B")}</Markdown>);
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(1));
  view.rerender(<Markdown>{fence("flowchart TD\n NEW --> B")}</Markdown>);
  await act(async () => {
    finish({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>OLD</text></svg>',
    });
  });
  const image = await screen.findByRole("img");
  expect(decodeURIComponent(image.getAttribute("src")!)).not.toContain("OLD");
  expect(document.querySelector(".mermaid-measurement")).toBeNull();
  view.unmount();
});

it("waits for visibility and disconnects the observer when unmounted", async () => {
  let reveal!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        reveal = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  try {
    const view = render(<Markdown>{fence("flowchart TD\n A --> B")}</Markdown>);
    expect(engine.render).not.toHaveBeenCalled();
    act(() =>
      reveal(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    await screen.findByRole("img");
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("cleans up an active measurement after unmount without publishing its result", async () => {
  let finish!: (value: { svg: string }) => void;
  engine.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<Markdown>{fence("flowchart TD\n A --> B")}</Markdown>);
  await waitFor(() => expect(engine.render).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () =>
    finish({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>',
    }),
  );
  expect(document.querySelector(".mermaid-measurement")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
});

it("counts case-insensitive Mermaid fences inside nested quotes together", async () => {
  const content = Array.from({ length: 9 }, () =>
    fence("flowchart TD\n A --> B")
      .replace("mermaid", "Mermaid")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
  ).join("\n\n");
  render(<Markdown>{content}</Markdown>);
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(8));
  expect(screen.getByRole("status")).toHaveTextContent("limite");
});

it("rejects more than 300 source lines before rendering", () => {
  render(<Markdown>{fence("%% comment\n".repeat(301))}</Markdown>);
  expect(screen.getByRole("status")).toHaveTextContent("limite");
  expect(engine.render).not.toHaveBeenCalled();
});
