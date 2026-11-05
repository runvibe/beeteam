import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Globe,
  Hexagon,
  List,
} from "lucide-react";
import { ThemeControl } from "@/components/theme-control";
import { setLocalePreference, t, useLocale } from "@/i18n";
import { harnesses, type Harness } from "@/launch/bootstrap";
import { Articles } from "./Articles";
import { Installation } from "./Installation";
import { Tutorial } from "./Tutorial";
import {
  groups,
  pages,
  guideHref,
  readHarness,
  rememberHarness,
} from "./navigation";
import "./guide.css";

const Environment = lazy(() => import("./Environment"));
const Tools = lazy(() => import("./Tools"));
const harnessNames: Record<Harness, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  "github-copilot": "GitHub Copilot CLI",
  other: "",
};
function scrollToAnchor() {
  try {
    document
      .getElementById(decodeURIComponent(location.hash.slice(1)))
      ?.scrollIntoView();
  } catch {
    /* Invalid fragment in an external link. */
  }
}
export function Guide() {
  const pt = useLocale() === "pt-BR";
  const [queryClient] = useState(() => new QueryClient());
  const [harness, setHarness] = useState(() =>
    readHarness(new URL(location.href)),
  );
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const topic =
    location.pathname.replace(/^\/guide\/?/, "").replace(/\/$/, "") || "about";
  const index = pages.findIndex((p) => p[0] === topic);
  const page = pages[index];
  const title = page ? t(page[1]) : t("guide.pageNotFound");
  const group = groups.find((g) => g.pages.some((p) => p[0] === topic));
  const picker = [
    "installation",
    "connect",
    "first-team",
    "parallel-tasks",
    "review",
  ].includes(topic);
  const languageCode = pt ? "pt".toUpperCase() : "en".toUpperCase();
  const docs = t("guide.documentation");
  function select(h: Harness) {
    const url = new URL(location.href);
    url.searchParams.set("harness", h);
    history.replaceState(history.state, "", url);
    rememberHarness(h);
    setHarness(h);
  }
  useEffect(() => {
    document.title = title + " · " + docs + " | " + t("common.getBeeTeamBrand");
  }, [title, docs]);
  useEffect(() => {
    if (location.hash) scrollToAnchor();
    else if (sessionStorageAvailableFocus())
      heading.current?.focus({ preventScroll: true });
    function sessionStorageAvailableFocus() {
      try {
        const should = sessionStorage.getItem("guide.focus") === "article";
        sessionStorage.removeItem("guide.focus");
        return should;
      } catch {
        return false;
      }
    }
  }, [topic]);
  const article =
    topic === "installation" ? (
      <Installation harness={harness} />
    ) : topic === "reference/environment" ? (
      <Environment pt={pt} />
    ) : topic === "reference/mcp/tools" ? (
      <Tools pt={pt} />
    ) : ["connect", "first-team", "parallel-tasks", "review"].includes(
        topic,
      ) ? (
      <Tutorial harness={harness} topic={topic} />
    ) : (
      <Articles harness={harness} topic={topic} />
    );
  return (
    <QueryClientProvider client={queryClient}>
      <div className="guide-page">
        <header className="guide-header">
          <div>
            <a href="/" className="guide-brand">
              <Hexagon aria-hidden="true" />
              {t("common.getBeeTeamBrand")}
            </a>
            <span className="guide-header-divider">/</span>
            <a href={guideHref("", harness)}>{docs}</a>
          </div>
          <div>
            <a href="/app/" className="guide-open">
              {t("guide.openApp")} <ArrowRight size={15} />
            </a>
            <button
              className="guide-language"
              onClick={() => setLocalePreference(pt ? "en" : "pt")}
              aria-label={t("guide.switchToPortuguese")}
            >
              <Globe size={15} />
              {languageCode}
            </button>
            <ThemeControl />
          </div>
        </header>
        <div className="guide-layout">
          <aside className={"guide-sidebar" + (open ? " is-open" : "")}>
            <button
              className="guide-contents"
              aria-expanded={open}
              aria-controls="guide-topic-list"
              onClick={() => setOpen((v) => !v)}
            >
              <List size={16} />
              {t("guide.contents")}
              <ChevronDown size={16} />
            </button>
            <nav
              id="guide-topic-list"
              aria-label={t("guide.documentationTopics")}
            >
              {groups.map((g) => (
                <div key={g.label}>
                  <h2>{t(g.label)}</h2>
                  {g.pages.map((p) => (
                    <a
                      key={p[0]}
                      aria-current={topic === p[0] ? "page" : undefined}
                      href={guideHref(p[0], harness)}
                      onClick={() => {
                        if (open) {
                          try {
                            sessionStorage.setItem("guide.focus", "article");
                          } catch {
                            /* optional focus restoration */
                          }
                        }
                      }}
                    >
                      {t(p[1])}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
          <main className="guide-article">
            <div className="guide-trail">
              <BookOpen size={15} />
              {docs}
              {group && <> / {t(group.label)}</>}
            </div>
            <h1 tabIndex={-1} ref={heading}>
              {title}
            </h1>
            {picker && (
              <fieldset className="guide-picker">
                <legend>{t("guide.yourHarness")}</legend>
                {harnesses.map((h) => (
                  <button
                    type="button"
                    key={h}
                    aria-pressed={h === harness}
                    onClick={() => select(h)}
                  >
                    {harnessNames[h] || t("guide.other")}
                  </button>
                ))}
              </fieldset>
            )}
            {page ? (
              <Suspense fallback={<p>{t("guide.loading")}</p>}>
                {article}
              </Suspense>
            ) : (
              <p>
                <a href={guideHref("", harness)}>{t("guide.backToTheGuide")}</a>
              </p>
            )}
            <nav
              className="guide-turn"
              aria-label={t("guide.articleNavigation")}
            >
              {index > 0 && (
                <a href={guideHref(pages[index - 1][0], harness)}>
                  <ArrowLeft size={16} />
                  {t(pages[index - 1][1])}
                </a>
              )}
              {index >= 0 && index < pages.length - 1 && (
                <a href={guideHref(pages[index + 1][0], harness)}>
                  {t(pages[index + 1][1])}
                  <ArrowRight size={16} />
                </a>
              )}
            </nav>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
