import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ThemedTokenWithVariants } from "shiki";
import "./markdown-code.css";

type Highlight = {
  source: string;
  language: string;
  lines: ThemedTokenWithVariants[][];
};

export function HighlightedCode({
  source,
  language,
  fallback,
}: {
  source: string;
  language: string;
  fallback: ReactNode;
}) {
  const [highlight, setHighlight] = useState<Highlight>();

  useEffect(() => {
    let active = true;
    void (async () => {
      const shiki = await import("shiki/bundle/full");
      if (!active || !Object.hasOwn(shiki.bundledLanguages, language)) return;
      const lang = language as keyof typeof shiki.bundledLanguages;
      const lines = await shiki.codeToTokensWithThemes(source, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
      });
      if (active) setHighlight({ source, language, lines });
    })().catch((error: unknown) => {
      if (active) console.error("markdown_highlight_failed", error);
    });
    return () => {
      active = false;
    };
  }, [source, language]);

  if (highlight?.source !== source || highlight.language !== language) {
    return fallback;
  }

  return (
    <pre className="markdown-highlight">
      <code className={`language-${language}`}>
        {highlight.lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && "\n"}
            {line.map((token, tokenIndex) => {
              const style: CSSProperties & {
                "--code-light"?: string;
                "--code-dark"?: string;
              } = {
                "--code-light": token.variants.light?.color,
                "--code-dark": token.variants.dark?.color,
              };
              return (
                <span key={tokenIndex} style={style}>
                  {token.content}
                </span>
              );
            })}
          </Fragment>
        ))}
      </code>
    </pre>
  );
}
