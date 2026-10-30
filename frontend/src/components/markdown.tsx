import { createElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Stable renderers retain focus and DOM identity during query refreshes.
const baseComponents: Components = {
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
      aria-label="Tabela"
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
};
const documentComponents: Components = { ...baseComponents };
for (const level of [1, 2, 3, 4, 5, 6] as const) {
  documentComponents[`h${level}`] = ({ children }: { children?: ReactNode }) =>
    createElement(
      `h${Math.min(6, level + 2)}`,
      { className: `document-heading-${level}` },
      children,
    );
}
export function Markdown({
  children,
  headingOffset = 0,
}: {
  children: string;
  headingOffset?: 0 | 2;
}) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={headingOffset ? documentComponents : baseComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
