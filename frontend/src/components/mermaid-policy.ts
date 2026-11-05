export const MAX_MERMAID_CHARS = 16_000;
export const MAX_MERMAID_LINES = 300;
export const MAX_MERMAID_DIAGRAMS = 8;
export type MermaidFailure = "limit" | "unsafe" | "render";

// Mermaid is a display format here, not a configuration or interaction surface.
// Check before importing/parsing: directives, embedded resources and author CSS
// must never reach Mermaid's temporary measurement DOM.
export function mermaidSourceFailure(source: string): MermaidFailure | null {
  if (
    source.length > MAX_MERMAID_CHARS ||
    source.split("\n").length > MAX_MERMAID_LINES
  )
    return "limit";
  if (
    /^\s*---|%%\s*\{|<\s*\/?\s*[a-z!]|!\[|\b(?:img|image)\s*:|url\s*\(|@import|\\/i.test(
      source,
    )
  )
    return "unsafe";
  return null;
}

interface MarkdownNode {
  type: string;
  lang?: string | null;
  children?: MarkdownNode[];
  data?: { hProperties?: Record<string, unknown> };
}

// Count the whole document, including nested lists/quotes, without mutating text.
export function remarkMermaidLimit() {
  return (tree: MarkdownNode) => {
    let count = 0;
    const visit = (node: MarkdownNode) => {
      if (node.type === "code" && node.lang?.toLowerCase() === "mermaid") {
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            "data-mermaid-limited": ++count > MAX_MERMAID_DIAGRAMS,
          },
        };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
