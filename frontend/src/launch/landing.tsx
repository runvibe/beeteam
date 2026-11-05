import { useState, type ReactNode } from "react";
import { Hexagon, ArrowUpRight, Check, Copy } from "lucide-react";
import { t, useLocale, setLocalePreference } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ThemeControl } from "@/components/theme-control";
import { bootstrapCommand, type Harness } from "./bootstrap";
import { usePublicManifest } from "./public-manifest";
import { navigate, currentUrl } from "@/routing/location";
import "./landing.css";
import { HeroBoard } from "./hero-board";

export function Landing({ connection }: { connection?: ReactNode }) {
  const language = useLocale();
  const manifest = usePublicManifest();
  const [harness, setHarness] = useState<Harness>("codex");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const command = manifest.data
    ? bootstrapCommand(manifest.data, harness)
    : null;
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
      <header className="launch-header">
        <a href="/?demo=0" className="launch-brand">
          <Hexagon aria-hidden="true" />
          <span>{t("common.getBeeTeamBrand")}</span>
        </a>
        <nav aria-label={t("common.launchNavigation")}>
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
                    `/boards?${new URLSearchParams({ demo: "1", returnTo: currentUrl() })}`,
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
            <p>
              {t("common.launchNodeHelp")}{" "}
              <a
                href="https://nodejs.org/en/download"
                target="_blank"
                rel="noreferrer"
              >
                {t("common.launchNodeDownload")}
              </a>
            </p>
          </div>
          <div className="launch-command">
            <label htmlFor="launch-harness">{t("common.launchHarness")}</label>
            <select
              id="launch-harness"
              value={harness}
              onChange={(event) => {
                setHarness(event.target.value as Harness);
                setCopyState("idle");
              }}
            >
              <option value="codex">{t("common.harnessCodex")}</option>
              <option value="claude-code">{t("common.harnessClaude")}</option>
              <option value="github-copilot">
                {t("common.harnessCopilot")}
              </option>
              <option value="other">{t("common.harnessOther")}</option>
            </select>
            {command ? (
              <>
                <pre tabIndex={0}>
                  <code>{command}</code>
                </pre>
                <Button onClick={() => void copy()}>
                  {copyState === "copied" ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                  {t("common.launchCopyCommand")}
                </Button>
                <p>{t("common.launchProjectScope")}</p>
                <p>{t("common.launchAskSetup")}</p>
              </>
            ) : (
              <p role="status">
                {harness === "other"
                  ? t("common.launchManualHarness")
                  : t("common.launchReleaseUnavailable")}
              </p>
            )}
            {copyState !== "idle" && (
              <p role="status">
                {copyState === "copied"
                  ? t("common.launchCopied")
                  : t("common.launchCopyFailed")}
              </p>
            )}
            <a
              href={
                manifest.data
                  ? `${manifest.data.skills.repository}/tree/${encodeURIComponent(manifest.data.skills.ref)}/skills`
                  : "https://github.com/runvibe/beeteam"
              }
              target="_blank"
              rel="noreferrer"
            >
              {t("common.launchManualInstructions")}
            </a>
          </div>
        </section>
        {connection && (
          <section
            className="launch-connection"
            aria-label={t("common.connectGetBeeTeam")}
          >
            {connection}
          </section>
        )}
      </main>
      <footer className="launch-footer">
        <span>{t("common.getBeeTeamBrand")}</span>
        <p>{t("common.launchFooter")}</p>
      </footer>
    </div>
  );
}
