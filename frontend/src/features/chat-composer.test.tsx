import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { Composer } from "./managed-agent-chat-parts";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

function setup(value = "") {
  const props = {
    value,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    locked: false,
    canSend: true,
    retry: false,
  };
  const view = render(<Composer {...props} />);
  const editor = screen.getByRole("textbox", { name: "Message to agent" });
  return { ...view, editor, props };
}

function mockNativeHtmlInsertion(editor: HTMLElement) {
  const nativeEdit = vi.fn((command: string, _ui?: boolean, html?: string) => {
    if (command !== "insertHTML") return false;
    const selection = document.getSelection()!;
    const fragment = document.createRange().createContextualFragment(html ?? "");
    const range = selection.getRangeAt(0);
    if (
      editor.lastChild?.nodeType === Node.TEXT_NODE &&
      editor.lastChild.textContent?.endsWith("\n") &&
      range.endContainer === editor.lastChild &&
      range.endOffset === editor.lastChild.textContent.length &&
      !range.collapsed &&
      fragment.lastChild?.nodeName !== "BR"
    )
      fragment.append(document.createTextNode("\n"));
    const last = fragment.lastChild!;
    range.deleteContents();
    range.insertNode(fragment);
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.input(editor);
    return true;
  });
  const descriptor = Object.getOwnPropertyDescriptor(document, "execCommand");
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: nativeEdit,
  });
  return {
    nativeEdit,
    restore: () => {
      if (descriptor) Object.defineProperty(document, "execCommand", descriptor);
      else Reflect.deleteProperty(document, "execCommand");
    },
  };
}

it("exposes a multiline plaintext editor with an accessible placeholder", () => {
  const { editor } = setup();
  expect(editor).toHaveAttribute("contenteditable", "plaintext-only");
  expect(editor).toHaveAttribute("aria-multiline", "true");
  expect(editor).toHaveAttribute("aria-placeholder");
});

it("preserves the caret when the edited draft is echoed by its parent", () => {
  const { editor, props, rerender } = setup();
  editor.textContent = "hello";
  const text = editor.firstChild!;
  const selection = document.getSelection()!;
  const range = document.createRange();
  range.setStart(text, 2);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("hello");
  rerender(<Composer {...props} value="hello" />);
  expect(editor.firstChild).toBe(text);
  expect(selection.anchorNode).toBe(text);
  expect(selection.anchorOffset).toBe(2);
});

it("synchronizes suggestions and cleared drafts from outside the editor", () => {
  const { editor, props, rerender } = setup("old draft");
  rerender(<Composer {...props} value={"Suggestion\nwith Markdown **text**"} />);
  expect(editor.textContent).toBe("Suggestion\nwith Markdown **text**");
  rerender(<Composer {...props} value="" />);
  expect(editor.textContent).toBe("");
});

it("keeps an externally supplied final newline editable in browsers", () => {
  const { editor } = setup("draft\n");
  expect(Array.from(editor.childNodes, (node) => node.textContent)).toEqual([
    "draft\n",
    "\n",
  ]);
});

it("preserves blank and trailing lines in browser-generated editable blocks", () => {
  const { editor, props } = setup();
  editor.innerHTML = "alpha<div><br></div><div>beta</div><div><br></div>";
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("alpha\n\nbeta\n");
});

it("does not add an extra line when a block follows browser line breaks", () => {
  const { editor, props } = setup();
  editor.innerHTML = "alpha\n\n<div>beta</div>";
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("alpha\n\nbeta");
});

it("does not include the browser's trailing line-break placeholder", () => {
  const { editor, props } = setup();
  editor.replaceChildren(
    document.createTextNode("alpha"),
    document.createTextNode("\n"),
    document.createTextNode("\n"),
  );
  fireEvent.input(editor, { inputType: "insertLineBreak" });
  expect(props.onChange).toHaveBeenLastCalledWith("alpha\n");
});

it("ignores empty text nodes after a trailing line-break placeholder", () => {
  const { editor, props } = setup("old");
  editor.replaceChildren(
    document.createTextNode("alpha\nx\n"),
    document.createElement("br"),
    document.createTextNode(""),
  );
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("alpha\nx\n");
});

it("ignores a trailing caret newline merged into the last text node", () => {
  const { editor, props } = setup("old");
  editor.replaceChildren(
    document.createTextNode("alpha\n"),
    document.createTextNode("x\n\n"),
  );
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("alpha\nx\n");
});

it("removes a deleted final line even when its caret placeholder remains", () => {
  const { editor, props } = setup("alpha\n");
  editor.replaceChildren(
    document.createTextNode("alpha"),
    document.createTextNode("\n"),
  );
  fireEvent.input(editor, { inputType: "deleteContentBackward" });
  expect(props.onChange).toHaveBeenLastCalledWith("alpha");
});

it("treats a sole browser line-break placeholder as an empty draft", () => {
  const { editor, props } = setup("alpha");
  editor.replaceChildren(document.createTextNode("\n"));
  fireEvent.input(editor, { inputType: "deleteContentBackward" });
  expect(props.onChange).toHaveBeenLastCalledWith("");
});

it("reports editable text without serializing HTML markup", () => {
  const { editor, props } = setup("hello world");
  editor.innerHTML = "hello <b>*folks*</b>\n&lt;code&gt;";
  fireEvent.input(editor);
  expect(props.onChange).toHaveBeenLastCalledWith("hello *folks*\n<code>");
});

it("pastes only plain text into the current selection", () => {
  const { editor, props } = setup("hello world");
  const selection = document.getSelection()!;
  const range = document.createRange();
  range.setStart(editor.firstChild!, 6);
  range.setEnd(editor.firstChild!, 11);
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.paste(editor, {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? "*folks*\n<code>" : "<b>ignored</b>",
      types: ["text/plain", "text/html"],
    },
  });
  expect(props.onChange).toHaveBeenLastCalledWith("hello *folks*\n<code>");
  expect(editor.querySelector("b, code")).toBeNull();
});

it("inserts dropped multiline content as plain text", () => {
  const { editor, props } = setup();
  fireEvent.drop(editor, {
    clientX: 0,
    clientY: 0,
    dataTransfer: {
      getData: (type: string) =>
        type === "text/plain" ? "a\n\n<code>" : "<b>ignored</b>",
      types: ["text/plain", "text/html"],
    },
  });
  expect(props.onChange).toHaveBeenLastCalledWith("a\n\n<code>");
  expect(editor.querySelector("b, code")).toBeNull();
});

it("leaves a drag originating in the editor to the browser", () => {
  const { editor, props } = setup("draft");
  fireEvent.dragStart(editor);
  const drop = createEvent.drop(editor, {
    dataTransfer: {
      getData: () => "draft",
      types: ["text/plain"],
    },
  });
  fireEvent(editor, drop);
  fireEvent.dragEnd(editor);
  expect(drop.defaultPrevented).toBe(false);
  expect(props.onChange).not.toHaveBeenCalled();
});

it("inserts a large multiline paste without repeated edits or partial updates", () => {
  const { editor, props } = setup("left right");
  editor.focus();
  const selection = document.getSelection()!;
  const range = document.createRange();
  range.setStart(editor.firstChild!, 5);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  const text = `${"line\n".repeat(12_000)}<b>&`;
  const { nativeEdit, restore } = mockNativeHtmlInsertion(editor);
  const paste = createEvent.paste(editor, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      types: ["text/plain", "text/html"],
    },
  });
  try {
    fireEvent(editor, paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(nativeEdit).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(`left ${text}right`);
    expect(editor.querySelector("b")).toBeNull();
    expect(editor).toHaveAttribute("contenteditable", "plaintext-only");
  } finally {
    restore();
  }
});

it("replaces the trailing caret placeholder when pasting at the end", () => {
  const { editor, props } = setup("alpha\n");
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const { restore } = mockNativeHtmlInsertion(editor);
  try {
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "x\n" : ""),
        types: ["text/plain"],
      },
    });
    expect(props.onChange).toHaveBeenLastCalledWith("alpha\nx\n");
  } finally {
    restore();
  }
});

it("keeps a pasted newline after an existing break placeholder", () => {
  const { editor, props } = setup("alpha");
  editor.replaceChildren(
    document.createTextNode("alpha"),
    document.createElement("br"),
  );
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild!, 5);
  range.collapse(true);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const { restore } = mockNativeHtmlInsertion(editor);
  try {
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "\n" : ""),
        types: ["text/plain"],
      },
    });
    expect(props.onChange).toHaveBeenLastCalledWith("alpha\n");
  } finally {
    restore();
  }
});

it("replaces a caret placeholder merged into the final text node", () => {
  const { editor, props } = setup("alpha");
  editor.replaceChildren(document.createTextNode("alpha\n"));
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild!, 5);
  range.collapse(true);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const { restore } = mockNativeHtmlInsertion(editor);
  try {
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "B" : ""),
        types: ["text/plain"],
      },
    });
    expect(props.onChange).toHaveBeenLastCalledWith("alphaB");
  } finally {
    restore();
  }
});

it("preserves ordinary spaces when inserting a paragraph in the middle", () => {
  const { editor, props } = setup("aa  b");
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild!, 4);
  range.collapse(true);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const event = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertParagraph",
  });
  fireEvent(editor, event);
  expect(event.defaultPrevented).toBe(true);
  expect(props.onChange).toHaveBeenLastCalledWith("aa  \nb");
});

it("does not intercept a paragraph event during IME composition", () => {
  const { editor } = setup("draft");
  fireEvent.compositionStart(editor);
  const event = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertParagraph",
  });
  fireEvent(editor, event);
  expect(event.defaultPrevented).toBe(false);
  fireEvent.compositionEnd(editor);
  const nativeComposition = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertParagraph",
    isComposing: true,
  });
  fireEvent(editor, nativeComposition);
  expect(nativeComposition.defaultPrevented).toBe(false);
});

it("keeps explicitly pasted nonbreaking spaces and normalizes line endings", () => {
  const { editor, props } = setup("aa  b");
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild!, 4);
  range.collapse(true);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.paste(editor, {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? "\u00a0\r\n<code>" : "",
      types: ["text/plain"],
    },
  });
  expect(props.onChange).toHaveBeenLastCalledWith("aa  \u00a0\n<code>b");
});

it("preserves a newline pasted into an empty editor", () => {
  const { editor, props } = setup();
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.paste(editor, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? "\n" : ""),
      types: ["text/plain"],
    },
  });
  expect(props.onChange).toHaveBeenLastCalledWith("\n");
});

it("does not submit Enter during IME composition and keeps Shift+Enter available", () => {
  const { editor, props } = setup("draft");
  fireEvent.compositionStart(editor);
  fireEvent.keyDown(editor, { key: "Enter" });
  fireEvent.keyDown(editor, { key: "Enter", isComposing: true });
  expect(props.onSubmit).not.toHaveBeenCalled();
  fireEvent.compositionEnd(editor);
  fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
  expect(props.onSubmit).not.toHaveBeenCalled();
  fireEvent.keyDown(editor, { key: "Enter" });
  expect(props.onSubmit).toHaveBeenCalledTimes(1);
});

it("defers external draft replacement until composition finishes", () => {
  const { editor, props, rerender } = setup("draft");
  fireEvent.compositionStart(editor);
  editor.textContent = "composing";
  fireEvent.input(editor);
  rerender(<Composer {...props} value="suggestion" />);
  expect(editor.textContent).toBe("composing");
  fireEvent.compositionEnd(editor);
  expect(editor.textContent).toBe("suggestion");
});

it("keeps the latest external draft when it matches the last composition update", () => {
  const { editor, props, rerender } = setup("draft");
  fireEvent.compositionStart(editor);
  editor.textContent = "composing";
  fireEvent.input(editor);
  rerender(<Composer {...props} value="composing" />);
  rerender(<Composer {...props} value="suggestion" />);
  rerender(<Composer {...props} value="composing" />);
  fireEvent.compositionEnd(editor);
  expect(editor.textContent).toBe("composing");
  expect(props.onChange).not.toHaveBeenCalledWith("suggestion");
});

it("marks a locked draft as disabled without losing its contents", () => {
  const { editor, props, rerender } = setup("preserved");
  rerender(<Composer {...props} locked />);
  expect(editor).toHaveAttribute("contenteditable", "false");
  expect(editor).toHaveAttribute("aria-disabled", "true");
  expect(editor.textContent).toBe("preserved");
  fireEvent.keyDown(editor, { key: "Enter" });
  fireEvent.paste(editor, {
    clipboardData: {
      getData: () => "unexpected",
      types: ["text/plain"],
    },
  });
  fireEvent.drop(editor, {
    dataTransfer: {
      getData: () => "unexpected",
      types: ["text/plain"],
    },
  });
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(props.onChange).not.toHaveBeenCalled();
  expect(editor.textContent).toBe("preserved");
});
