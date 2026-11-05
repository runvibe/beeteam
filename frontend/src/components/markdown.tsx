import { useLocale, t as tr } from "@/i18n";

import { createElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkSectionDividers } from "./markdown-sections";
import { remarkMermaidLimit } from "./mermaid-policy";
import { MermaidDiagram } from "./mermaid-diagram";

const plainPlugins = [remarkGfm, remarkMermaidLimit];
const sectionPlugins = [remarkGfm, remarkSectionDividers, remarkMermaidLimit];

// Stable renderers retain focus and DOM identity during query refreshes.
const baseComponents: Components = {
  pre: ({ node, children, ...props }) => {
    const code = node?.children[0];
    if (
      code?.type === "element" &&
      code.tagName === "code" &&
      Array.isArray(code.properties.className) &&
      code.properties.className.some(
        (name) => String(name).toLowerCase() === "language-mermaid",
      )
    ) {
      const source = code.children
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("");
      return (
        <MermaidDiagram
          source={source}
          limited={code.properties["data-mermaid-limited"] === true}
        />
      );
    }
    return <pre {...props}>{children}</pre>;
  },
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  table: ({ children }) => (
    <div
      className="markdown-table"
      role="region"
      aria-label={tr("common.table")}
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
};
const documentComponents: Components = { ...baseComponents };
for (const level of [1, 2, 3, 4, 5, 6] as const) {
  documentComponents[`h${level}`] = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) =>
    createElement(
      `h${Math.min(6, level + 2)}`,
      {
        className: [`document-heading-${level}`, className]
          .filter(Boolean)
          .join(" "),
      },
      children,
    );
}
export function Markdown({
  children,
  headingOffset = 0,
  sectionDividers = false,
}: {
  children: string;
  headingOffset?: 0 | 2;
  sectionDividers?: boolean;
}) {
  useLocale();
  return (
    <div className="markdown-content">
      <ReactMarkdown
        skipHtml
        remarkPlugins={sectionDividers ? sectionPlugins : plainPlugins}
        components={headingOffset ? documentComponents : baseComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
