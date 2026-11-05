import { useLayoutEffect, useRef, useState } from "react";
import { Hexagon, ArrowUpRight, Check, Copy, Terminal } from "lucide-react";
import { t, useLocale, setLocalePreference } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ThemeControl } from "@/components/theme-control";
import { harnesses, type Harness } from "./bootstrap";
import { harnessIcon } from "@/features/harness-catalog";
import { themeController } from "@/state/theme-runtime";
import { navigate, currentUrl } from "@/routing/location";
import "./landing.css";
import { HeroBoard } from "./hero-board";

export function Landing() {
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
          <a
            href="https://github.com/runvibe/beeteam"
            target="_blank"
            rel="noreferrer"
          >
            {t("common.launchSource")}
          </a>
        </nav>
        <div className="launch-preferences">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setLocalePreference(language === "pt-BR" ? "en" : "pt")
            }
          >
            {language === "pt-BR"
              ? t("common.languageEnglish")
              : t("common.languagePortuguese")}
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
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/app/boards?${new URLSearchParams({ demo: "1", returnTo: currentUrl() })}`,
                  )
                }
              >
                {t("common.launchExploreDemo")}
              </Button>
            </div>
            <p className="launch-caption">{t("common.launchLocalOpen")}</p>
          </div>
        </section>
        <section
          className="launch-story"
          aria-labelledby="launch-workflow-title"
        >
          <h2 id="launch-workflow-title">{t("common.launchWorkflowTitle")}</h2>
          <div>
            <p>{t("common.launchWorkflowBody")}</p>
            <ul>
              <li>{t("common.launchTeamBenefit")}</li>
              <li>{t("common.launchEvidenceBenefit")}</li>
              <li>{t("common.launchContextBenefit")}</li>
            </ul>
          </div>
        </section>
        <section
          id="install"
          className="launch-install"
          aria-labelledby="launch-install-title"
        >
          <div>
            <h2 id="launch-install-title">{t("common.launchInstallTitle")}</h2>
            <p>{t("common.launchInstallBody")}</p>
          </div>
          <div className="launch-command">
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
            {command && <div className="launch-chat-prompt">
              <p aria-live="polite">{command}</p>
              <Button onClick={() => void copy()}>
                {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {t("common.copyChatPrompt")}
              </Button>
            </div>}
            {copyState !== "idle" && (
              <p role="status">
                {copyState === "copied"
                  ? t("common.launchCopied")
                  : t("common.launchCopyFailed")}
              </p>
            )}
            <a
              href="/install"
              target="_blank"
              rel="noreferrer"
            >
              {t("common.launchManualInstructions")}
            </a>
          </div>
        </section>
      </main>
      <footer className="launch-footer">
        <span>{t("common.getBeeTeamBrand")}</span>
        <p>{t("common.launchFooter")}</p>
      </footer>
    </div>
  );
}
