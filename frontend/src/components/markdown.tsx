import { useLocale, t as tr } from "@/i18n";

import { createElement, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkSectionDividers } from "./markdown-sections";
import { remarkMermaidLimit } from "./mermaid-policy";
import { MermaidDiagram } from "./mermaid-diagram";
import { HighlightedCode } from "./markdown-code";
import { remarkFileCitations } from "./markdown-file-citations";

const plainPlugins = [remarkGfm, remarkMermaidLimit];
const sectionPlugins = [remarkGfm, remarkSectionDividers, remarkMermaidLimit];
const citationPlugins = [remarkGfm, remarkMermaidLimit, remarkFileCitations];
const sectionCitationPlugins = [
  remarkGfm,
  remarkSectionDividers,
  remarkMermaidLimit,
  remarkFileCitations,
];

// Stable renderers retain focus and DOM identity during query refreshes.
const baseComponents: Components = {
  pre: ({ node, children, ...props }) => {
    const code = node?.children[0];
    if (code?.type === "element" && code.tagName === "code") {
      const classes = Array.isArray(code.properties.className)
        ? code.properties.className.map(String)
        : [];
      const language = classes
        .find((name) => name.toLowerCase().startsWith("language-"))
        ?.slice("language-".length)
        .toLowerCase();
      const source = code.children
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("");
      if (language === "mermaid") {
        return (
          <MermaidDiagram
            source={source}
            limited={code.properties["data-mermaid-limited"] === true}
          />
        );
      }
      if (language) {
        return (
          <HighlightedCode
            source={source}
            language={language}
            fallback={<pre {...props}>{children}</pre>}
          />
        );
      }
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
  fileCitations,
}: {
  children: string;
  headingOffset?: 0 | 2;
  sectionDividers?: boolean;
  fileCitations?: ReadonlyMap<number, ReactNode>;
}) {
  useLocale();
  const components = useMemo<Components>(() => {
    const base = headingOffset ? documentComponents : baseComponents;
    if (!fileCitations) return base;
    return {
      ...base,
      a: (props) => {
        const match =
          props.node?.properties["data-beeteam-citation"] === "true"
            ? props.href?.match(/^#beeteam-file-(\d+)$/)
            : undefined;
        const card = match ? fileCitations.get(Number(match[1])) : undefined;
        if (card) return <>{card}</>;
        return props.href ? (
          <a href={props.href} target="_blank" rel="noopener noreferrer">
            {props.children}
          </a>
        ) : (
          <span>{props.children}</span>
        );
      },
    };
  }, [headingOffset, fileCitations]);
  return (
    <div className="markdown-content">
      <ReactMarkdown
        skipHtml
        remarkPlugins={
          fileCitations
            ? sectionDividers
              ? sectionCitationPlugins
              : citationPlugins
            : sectionDividers
              ? sectionPlugins
              : plainPlugins
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
