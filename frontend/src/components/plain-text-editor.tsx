import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import "./plain-text-editor.css";

type PlainTextEditorProps = {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLDivElement>;
};

function plainText(container: Node): string {
  const children = Array.from(container.childNodes);
  let lastIndex = children.length - 1;
  while (
    lastIndex >= 0 &&
    children[lastIndex].nodeType === Node.TEXT_NODE &&
    !children[lastIndex].textContent
  )
    lastIndex--;
  return children
    .map((child, index) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        // Browsers keep an extra trailing newline to position the caret.
        if (index === lastIndex && text.endsWith("\n"))
          return text.slice(0, -1);
        return text;
      }
      if (child.nodeName === "BR")
        return index === lastIndex ? "" : "\n";
      const block = ["DIV", "P", "LI"].includes(child.nodeName);
      let previousIndex = index - 1;
      while (
        previousIndex >= 0 &&
        children[previousIndex].nodeType === Node.TEXT_NODE &&
        !children[previousIndex].textContent
      )
        previousIndex--;
      const previous = children[previousIndex];
      const alreadyBroken =
        previous?.nodeName === "BR" ||
        (previous?.nodeType === Node.TEXT_NODE &&
          previous.textContent?.endsWith("\n"));
      return (block && previous && !alreadyBroken ? "\n" : "") + plainText(child);
    })
    .join("");
}

function writeText(element: HTMLDivElement, value: string) {
  element.textContent = value;
  if (value.endsWith("\n"))
    element.append(element.ownerDocument.createTextNode("\n"));
}

function insertWithRange(element: HTMLDivElement, text: string) {
  const document = element.ownerDocument;
  const selection = document.getSelection();
  if (!selection?.rangeCount) {
    writeText(element, plainText(element) + text);
    return;
  }
  const range = selection.getRangeAt(0);
  if (
    range.collapsed &&
    range.endContainer.nodeType === Node.ELEMENT_NODE &&
    range.endOffset === range.endContainer.childNodes.length
  ) {
    const last = range.endContainer.lastChild;
    if (
      last?.nodeName === "BR" ||
      (last?.nodeType === Node.TEXT_NODE && last.textContent === "\n")
    )
      range.setStartBefore(last);
  }
  range.deleteContents();
  const inserted = document.createTextNode(text);
  range.insertNode(inserted);
  let following = inserted.nextSibling;
  while (following?.nodeType === Node.TEXT_NODE && !following.textContent)
    following = following.nextSibling;
  if (!following && text.endsWith("\n"))
    inserted.parentNode?.appendChild(document.createTextNode("\n"));
  range.setStartAfter(inserted);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function editableSelection(element: HTMLDivElement) {
  const document = element.ownerDocument;
  const selection = document.getSelection();
  if (
    selection &&
    (!selection.rangeCount ||
      !element.contains(selection.anchorNode) ||
      !element.contains(selection.focusNode))
  ) {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return selection;
}

function insertLineBreak(element: HTMLDivElement) {
  const document = element.ownerDocument;
  const selection = editableSelection(element);
  if (
    !selection?.rangeCount ||
    typeof document.execCommand !== "function" ||
    !document.execCommand("insertLineBreak")
  )
    insertWithRange(element, "\n");
}

function insertPlainText(element: HTMLDivElement, rawText: string) {
  const text = rawText.replace(/\r\n?/g, "\n");
  if (!text) return;
  const document = element.ownerDocument;
  const selection = editableSelection(element);
  // HTML parsing drops NUL characters, so insert those directly as text.
  if (
    !selection?.rangeCount ||
    typeof document.execCommand !== "function" ||
    text.includes("\0")
  ) {
    insertWithRange(element, text);
    return;
  }
  const selected = selection.getRangeAt(0);
  const prefix = selected.cloneRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(selected.endContainer, selected.endOffset);
  const fragment = prefix.cloneContents();
  fragment.append(document.createTextNode("."));
  const before = plainText(fragment).slice(0, -1);
  const current = plainText(element);
  const atEnd = before === current || before === current + "\n";
  let last = element.lastChild;
  while (last?.nodeType === Node.TEXT_NODE && !last.textContent)
    last = last.previousSibling;
  const textPlaceholder =
    last?.nodeType === Node.TEXT_NODE && !!last.textContent?.endsWith("\n");
  const hasPlaceholder = last?.nodeName === "BR" || textPlaceholder;
  if (atEnd && last && hasPlaceholder) {
    if (textPlaceholder) {
      const length = last.textContent!.length;
      if (selected.collapsed) selected.setStart(last, length - 1);
      selected.setEnd(last, length);
    } else {
      if (selected.collapsed) selected.setStartBefore(last);
      selected.setEndAfter(last);
    }
  }
  const escaped = document.createElement("span");
  escaped.textContent = text;
  const html = escaped.innerHTML + (atEnd && !textPlaceholder ? "<br>" : "");
  const previous = element.contentEditable;
  let inserted;
  try {
    // The fragment is escaped text; one native insertion preserves undo.
    element.contentEditable = "true";
    inserted = document.execCommand("insertHTML", false, html);
  } finally {
    element.contentEditable = previous;
  }
  if (!inserted) insertWithRange(element, text);
}

function selectDropPosition(element: HTMLDivElement, x: number, y: number) {
  const document = element.ownerDocument;
  element.focus();
  const position = document.caretPositionFromPoint?.(x, y);
  let range = document.caretRangeFromPoint?.(x, y) ?? null;
  if (!range && position) {
    range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  }
  if (!range || !element.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
  }
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function PlainTextEditor({
  ref,
  id,
  className,
  value,
  onChange,
  onKeyDown,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: PlainTextEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const internalDrag = useRef(false);
  const deferredValue = useRef<string | null>(null);
  const lastChange = useRef(value);
  const [empty, setEmpty] = useState(value.length === 0);
  useImperativeHandle(ref, () => editor.current!, []);

  function synchronize(element: HTMLDivElement, next: string) {
    if (plainText(element) !== next) writeText(element, next);
    lastChange.current = next;
    setEmpty(next.length === 0);
  }

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element) return;
    if (composing.current) {
      if (value !== lastChange.current || deferredValue.current !== null)
        deferredValue.current = value;
      return;
    }
    synchronize(element, value);
  }, [value]);

  const report = useCallback((element: HTMLDivElement) => {
    const next = plainText(element);
    setEmpty(next.length === 0);
    if (composing.current && deferredValue.current !== null) return;
    if (next !== lastChange.current) {
      lastChange.current = next;
      onChange(next);
    }
  }, [onChange]);

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element) return;
    const beforeInput = (event: InputEvent) => {
      if (
        event.inputType !== "insertParagraph" ||
        !event.cancelable ||
        event.isComposing ||
        composing.current ||
        disabled
      )
        return;
      event.preventDefault();
      insertLineBreak(element);
      report(element);
    };
    element.addEventListener("beforeinput", beforeInput);
    return () => element.removeEventListener("beforeinput", beforeInput);
  }, [disabled, report]);

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    const element = event.currentTarget;
    insertPlainText(element, event.clipboardData.getData("text/plain"));
    report(element);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    if (internalDrag.current && !disabled) {
      internalDrag.current = false;
      return;
    }
    event.preventDefault();
    if (disabled) return;
    const element = event.currentTarget;
    selectDropPosition(element, event.clientX, event.clientY);
    insertPlainText(element, event.dataTransfer.getData("text/plain"));
    report(element);
  }

  return (
    <div
      ref={editor}
      id={id}
      className={["plain-text-editor", className].filter(Boolean).join(" ")}
      role="textbox"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-multiline="true"
      aria-placeholder={placeholder}
      aria-disabled={disabled || undefined}
      contentEditable={disabled ? false : "plaintext-only"}
      tabIndex={disabled ? -1 : 0}
      data-empty={empty || undefined}
      data-placeholder={placeholder}
      onInput={(event) => {
        if (!disabled) report(event.currentTarget);
      }}
      onPaste={paste}
      onDragStart={() => {
        internalDrag.current = true;
      }}
      onDragEnd={() => {
        internalDrag.current = false;
      }}
      onDrop={drop}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        const deferred = deferredValue.current;
        deferredValue.current = null;
        if (deferred !== null) {
          synchronize(event.currentTarget, deferred);
          if (deferred !== value) onChange(deferred);
        } else {
          report(event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        if (
          disabled ||
          (event.key === "Enter" &&
            (composing.current ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229))
        )
          return;
        onKeyDown?.(event);
      }}
    />
  );
}
