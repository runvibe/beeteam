import { Blob as NodeBlob } from "node:buffer";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Markdown } from "./markdown";

// jsdom's Blob does not implement stream(), which Shiki uses to load its WASM.
beforeEach(() => vi.stubGlobal("Blob", NodeBlob));
afterEach(() => vi.unstubAllGlobals());

it("highlights a JavaScript block without changing its source", async () => {
  const source = 'const greeting = "hello";';
  const { container } = render(
    <Markdown>{`\`\`\`js\n${source}\n\`\`\``}</Markdown>,
  );

  await waitFor(() => {
    expect(container.querySelector("pre code span[style]")).not.toBeNull();
  });
  expect(container.querySelector("pre code")).toHaveTextContent(source);
  const keyword = container.querySelector<HTMLElement>("pre code span");
  expect(keyword?.style.getPropertyValue("--code-light")).toBe("#D73A49");
  expect(keyword?.style.getPropertyValue("--code-dark")).toBe("#F97583");
});

it("highlights another supported language using its grammar", async () => {
  const { container } = render(
    <Markdown>{"```python\ndef hello():\n    return 42\n```"}</Markdown>,
  );
  await waitFor(() =>
    expect(container.querySelector("pre code span[style]")).not.toBeNull(),
  );
  expect(container.querySelector("pre code")).toHaveTextContent(
    "def hello(): return 42",
  );
});

it("preserves plain and unknown-language code as text", async () => {
  const { container } = render(
    <Markdown>
      {"```\nplain <code>\n```\n\n```not-a-real-language\nunknown <code>\n```"}
    </Markdown>,
  );
  await waitFor(() => {
    expect(container.querySelectorAll("pre code")).toHaveLength(2);
  });
  expect(container.querySelectorAll("pre code")[0]).toHaveTextContent(
    "plain <code>",
  );
  expect(container.querySelectorAll("pre code")[1]).toHaveTextContent(
    "unknown <code>",
  );
  expect(container.querySelector("pre code code")).toBeNull();
});

it("updates highlighted code when a streaming message changes", async () => {
  const view = render(<Markdown>{"```js\nconst a = 1\n```"}</Markdown>);
  await waitFor(() =>
    expect(view.container.querySelector("pre code span[style]")).not.toBeNull(),
  );
  view.rerender(<Markdown>{"```js\nconst b = 2\n```"}</Markdown>);
  expect(view.container.querySelector("pre code")).toHaveTextContent(
    "const b = 2",
  );
  await waitFor(() =>
    expect(view.container.querySelector("pre code span[style]")).not.toBeNull(),
  );
  expect(view.container.querySelector("pre code")).not.toHaveTextContent(
    "const a = 1",
  );
});
