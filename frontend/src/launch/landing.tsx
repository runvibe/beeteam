import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Hexagon, ArrowUpRight, Check, Copy, Globe, Terminal } from "lucide-react";
import { i18n, t, useLocale, setLocalePreference } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ThemeControl } from "@/components/theme-control";
import { harnesses, type Harness } from "./bootstrap";
import { harnessIcon } from "@/features/harness-catalog";
import { themeController } from "@/state/theme-runtime";
import "./landing.css";
import { HeroBoard } from "./hero-board";
import { HowItWorks } from "./how-it-works";

function RepositoryLink() {
  const label = t("common.launchSource");
  return (
    <a className="launch-github" href="https://github.com/runvibe/beeteam"
      aria-label={label} title={label} target="_blank" rel="noreferrer">
      <span aria-hidden="true" />
    </a>
  );
}

export function Landing() {
  const reducedMotion = useReducedMotion();
  useLayoutEffect(() => {
    const updateTitle = () => {
      document.title = `${t("common.getBeeTeamBrand")} | ${t("common.launchFooter")}`;
    };
    updateTitle();
    i18n.on("languageChanged", updateTitle);
    return () => {
      i18n.off("languageChanged", updateTitle);
      document.title = t("settings.documentTitle");
    };
  }, []);
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;
    const measure = () => el.parentElement?.style.setProperty("--launch-header-height", `${el.getBoundingClientRect().height}px`);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const language = useLocale();
  const [harness, setHarness] = useState<Harness | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const names = {
    codex: t("common.harnessCodex"),
    "claude-code": t("common.harnessClaude"),
    "github-copilot": t("common.harnessCopilot"),
    other: t("common.harnessOther"),
  };
  const command = harness ? (harness === "other" ? t("common.installChatOther") : t("common.installChatNamed", { harness: names[harness] })) : null;
  const chosenIcon = harness && harnessIcon(harness.replaceAll("-", " "));
  const languageAction = t(language === "pt-BR" ? "common.switchEnglish" : "common.switchPortuguese");
  function selectHarness(choice: Harness) {
    setHarness(choice);
    setCopyState("idle");
    themeController.store.getState().setPreset(choice === "other" ? "default" : choice === "github-copilot" ? "copilot" : choice);
  }
  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  return (
    <div className="launch-page">
      <header className="launch-header" ref={header}>
        <a href="/" className="launch-brand">
          <Hexagon aria-hidden="true" />
          <span>{t("common.getBeeTeamBrand")}</span>
        </a>
        <nav aria-label={t("common.launchNavigation")}>
          <a href="/app/">{t("common.launchOpenPanel")}</a>
          <a href="#install">{t("common.launchInstall")}</a>
          <RepositoryLink />
        </nav>
        <div className="launch-preferences">
          <Button
            variant="ghost"
            size="sm"
            title={languageAction}
            aria-label={languageAction}
            onClick={() =>
              setLocalePreference(language === "pt-BR" ? "en" : "pt")
            }
          >
            <Globe size={16} aria-hidden="true" />
            <span>{language.slice(0, 2).toUpperCase()}</span>
          </Button>
          <ThemeControl />
        </div>
      </header>
      <main>
        <section className="launch-hero">
          <HeroBoard />
          <div className="launch-intro">
            <p className="launch-eyebrow">{t("common.launchEyebrow")}</p>
            <h1>{t("common.launchHeadline")}</h1>
            <p className="launch-lead">{t("common.launchLead")}</p>
            <div className="launch-actions">
              <a className="launch-primary" href="#install">
                {t("common.launchInstall")}
                <ArrowUpRight aria-hidden="true" />
              </a>
              <Button asChild variant="outline">
                <a href="#how-it-works">{t("common.tourTitle")}</a>
              </Button>
            </div>
            <p className="launch-caption">{t("common.launchLocalOpen")}</p>
          </div>
        </section>
        <HowItWorks />
        <section
          id="install"
          className="launch-install"
          aria-label={t("common.launchInstallTitle")}
        >
          <div className="launch-command">
            <div className="launch-signal" aria-hidden="true">
              <div className="launch-signal-field" />
              <Hexagon className="launch-signal-ring" strokeWidth={0.35} />
              <Hexagon key={`ring-${harness ?? "initial"}`} className="launch-signal-ring inner" strokeWidth={0.55} />
              <div className="launch-signal-core" key={harness ?? "initial"}>
                {chosenIcon ? <img alt="" src={chosenIcon} /> : harness ? <Terminal /> : <Hexagon />}
              </div>
            </div>
            <fieldset className="launch-picker">
              <legend>{t("common.launchHarness")}</legend>
              {harnesses.map((choice) => {
                const icon = harnessIcon(choice.replaceAll("-", " "));
                return <button type="button" key={choice} aria-pressed={harness === choice}
                  onClick={() => selectHarness(choice)}>
                  {icon ? <img src={icon} alt="" /> : <Terminal aria-hidden="true" />}
                  <span>{names[choice]}</span>
                </button>;
              })}
            </fieldset>
            {command && <motion.div
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.34, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <strong className="launch-copy-hint">{t("common.installCopyHint")}</strong>
              <div className="launch-chat-prompt">
              <div className="launch-copy-heading">
                <Button size="sm" onClick={() => void copy()}>
                {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {t("common.copyChatPrompt")}
                </Button>
              </div>
              <motion.p key={harness} aria-live="polite"
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.24 }}
              >{command}</motion.p>
              </div>
            </motion.div>}
            {copyState === "failed" && (
              <p role="status">
                {t("common.launchCopyFailed")}
              </p>
            )}
            <div className="launch-guide-link"><a
              href="/install"
              target="_blank"
              rel="noreferrer"
            >
              {t("common.launchManualInstructions")}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a></div>
          </div>
        </section>
      </main>
      <footer className="launch-footer">
        <span className="launch-brand"><Hexagon aria-hidden="true" />{t("common.getBeeTeamBrand")}</span>
        <div className="launch-footer-links">
          <p>{t("common.launchFooter")}</p>
          <RepositoryLink />
        </div>
        <small className="launch-footer-notice">
          {t("common.launchFooterNotice", { year: String(new Date().getFullYear()) })}
        </small>
      </footer>
    </div>
  );
}
