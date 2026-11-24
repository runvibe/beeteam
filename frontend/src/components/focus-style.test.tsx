import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";

const css = [
  "src/App.css",
  "src/components/filters.css",
  "src/features/sessions-sidebar.css",
  "src/features/managed-agent-chat.css",
  "src/features/leader-chat.css",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

function fixture(markup: string) {
  const style = document.createElement("style");
  style.textContent = css;
  style.dataset.focusTest = "";
  document.head.append(style);
  const container = document.createElement("div");
  container.dataset.focusTest = "";
  container.innerHTML = markup;
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.querySelectorAll("[data-focus-test]").forEach((item) => item.remove());
  delete document.documentElement.dataset.focusSource;
});

it("keeps pointer focus while typing and restores keyboard focus on Tab", () => {
  window.history.replaceState({}, "", "/boards");
  const { unmount } = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  const input = document.createElement("input");
  input.dataset.focusTest = "";
  document.body.append(input);

  fireEvent.pointerDown(input);
  input.focus();
  expect(document.documentElement.dataset.focusSource).toBe("pointer");
  fireEvent.keyDown(input, { key: "a" });
  expect(document.documentElement.dataset.focusSource).toBe("pointer");

  const next = document.createElement("input");
  next.dataset.focusTest = "";
  document.body.append(next);
  next.focus();
  expect(document.documentElement.dataset.focusSource).toBe("keyboard");

  fireEvent.pointerDown(input);
  input.focus();
  fireEvent.keyDown(input, { key: "Tab" });
  expect(document.documentElement.dataset.focusSource).toBe("keyboard");
  fireEvent.pointerDown(input);
  expect(document.documentElement.dataset.focusSource).toBe("pointer");

  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  editor.dataset.focusTest = "";
  document.body.append(editor);
  fireEvent.keyDown(editor, { key: "a" });
  expect(document.documentElement.dataset.focusSource).toBe("pointer");
  fireEvent.keyDown(editor, { key: "Tab" });
  expect(document.documentElement.dataset.focusSource).toBe("keyboard");
  unmount();
  expect(document.documentElement.dataset.focusSource).toBeUndefined();
});

it.each(["input", "textarea", "select"])(
  "removes the pointer outline on a focused %s while retaining keyboard focus",
  (tag) => {
    const container = fixture(`<${tag}></${tag}>`);
    document.documentElement.dataset.focusSource = "pointer";
    const field = container.firstElementChild as HTMLElement;
    field.focus();
    expect(getComputedStyle(field).outline).toBe("none");

    document.documentElement.dataset.focusSource = "keyboard";
    field.classList.add("recalculate");
    expect(getComputedStyle(field).outline).toBe("2px solid var(--ring)");
    container.remove();
  },
);

it.each(["sessions-search", "inline-filter-search"])(
  "does not outline the %s wrapper on pointer focus",
  (className) => {
    const container = fixture(
      `<label class="${className}"><input type="search"></label>`,
    );
    document.documentElement.dataset.focusSource = "pointer";
    const wrapper = container.firstElementChild as HTMLElement;
    const input = wrapper.querySelector("input")!;
    input.focus();
    expect(getComputedStyle(wrapper).outline).toBe("");
    expect(getComputedStyle(input).outline).toBe("none");

    document.documentElement.dataset.focusSource = "keyboard";
    wrapper.classList.add("recalculate");
    expect(getComputedStyle(wrapper).outline).toBe("2px solid var(--ring)");
    container.remove();
  },
);

it("does not add a glow to the chat composer on pointer focus", () => {
  const container = fixture(
    `<div class="assistant-composer-box">
      <div class="plain-text-editor" contenteditable="true" tabindex="0"></div>
    </div>`,
  );
  document.documentElement.dataset.focusSource = "pointer";
  const wrapper = container.firstElementChild as HTMLElement;
  const editor = wrapper.firstElementChild as HTMLElement;
  editor.focus();
  expect(getComputedStyle(wrapper).boxShadow).toBe("var(--shadow-sm)");
  expect(getComputedStyle(wrapper).outline).toBe("");

  document.documentElement.dataset.focusSource = "keyboard";
  wrapper.classList.add("recalculate");
  expect(getComputedStyle(wrapper).outline).toBe("2px solid var(--ring)");
  container.remove();
});

it("removes the legacy editor glow on pointer focus and retains a keyboard outline", () => {
  const container = fixture(
    `<div class="leader-chat-composer">
      <div class="plain-text-editor" contenteditable="true" tabindex="0"></div>
    </div>`,
  );
  document.documentElement.dataset.focusSource = "pointer";
  const editor = container.querySelector(".plain-text-editor") as HTMLElement;
  editor.focus();
  expect(getComputedStyle(editor).boxShadow).toBe("");

  document.documentElement.dataset.focusSource = "keyboard";
  editor.classList.add("recalculate");
  expect(getComputedStyle(editor).outline).toBe("2px solid var(--ring)");
  container.remove();
});
