import type { Root } from "mdast";
import type { Properties } from "hast";

type Node = {
  type: string;
  value?: string;
  url?: string;
  children?: Node[];
  data?: { hProperties?: Properties };
};
const marker = /:beeteam-file-citation\{index=(\d+)\}/g;

function transform(node: Node) {
  if (!node.children || ["link", "linkReference"].includes(node.type)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type !== "text" || !child.value) {
      transform(child);
      return [child];
    }
    const pieces: Node[] = [];
    let position = 0;
    for (const match of child.value.matchAll(marker)) {
      if (match.index > position) {
        pieces.push({
          type: "text",
          value: child.value.slice(position, match.index),
        });
      }
      pieces.push({
        type: "link",
        url: `#beeteam-file-${match[1]}`,
        data: { hProperties: { "data-beeteam-citation": "true" } },
        children: [{ type: "text", value: match[0] }],
      });
      position = match.index + match[0].length;
    }
    if (!pieces.length) return [child];
    if (position < child.value.length) {
      pieces.push({ type: "text", value: child.value.slice(position) });
    }
    return pieces;
  });
}

export function remarkFileCitations() {
  return (tree: Root) => transform(tree);
}
