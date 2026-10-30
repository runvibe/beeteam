// Mark only root-level section boundaries; never change stored Markdown or child nodes.
interface Block {
  type: string;
  depth?: number;
  data?: { hProperties?: Record<string, unknown> };
}
export function remarkSectionDividers() {
  return (tree: { children: Block[] }) => {
    const headings = tree.children.filter((node) => node.type === "heading");
    const title =
      headings[0]?.depth === 1 &&
      headings.filter((node) => node.depth === 1).length === 1
        ? headings[0]
        : undefined;
    const sections = headings.filter((node) => node !== title);
    const depth = Math.min(...sections.map((node) => node.depth ?? 6));
    tree.children.forEach((node, index) => {
      const previous = tree.children[index - 1];
      if (
        node.type !== "heading" ||
        node === title ||
        node.depth !== depth ||
        !previous ||
        previous.type === "thematicBreak" ||
        previous.type === "heading"
      )
        return;
      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          className: "markdown-section-start",
        },
      };
    });
  };
}
