import { useState } from "react";
import { t, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useApiCompatibility } from "@/api/compatibility";
import { useDemo } from "@/components/demo-context";
import { navigate, safeOrigin, useLocation } from "@/routing/location";
import "./connected-home.css";

export function ConnectedHome() {
  useLocale();
  const url = useLocation();
  const { info } = useApiCompatibility();
  const demo = useDemo() || info?.apiVersion === "demo";
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const origin = safeOrigin(new URLSearchParams(url.split("?")[1]).get("from"));
  const resume =
    origin && !new URL(origin, location.origin).pathname.startsWith("/home")
      ? origin
      : null;
  const prompt = t("common.homeLeaderPrompt");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <section className="connected-home" aria-labelledby="home-title">
      <header>
        <p className="small-note">
          {demo
            ? t("common.demoBanner")
            : info
              ? t("common.homeConnection", { version: info.apiVersion })
              : t("common.connectionChecking")}
        </p>
        <h1 id="home-title">{t("common.homeTitle")}</h1>
        <p className="home-lead">{t("common.homeIntroduction")}</p>
        <div className="home-actions">
          {resume && (
            <Button onClick={() => navigate(resume)}>
              {t("common.homeResume")}
            </Button>
          )}
          <Button
            variant={resume ? "outline" : "default"}
            onClick={() => navigate("/boards")}
          >
            {t("common.homeOpenBoards")}
          </Button>
        </div>
      </header>
      <section
        className="home-getting-started"
        aria-labelledby="home-start-title"
      >
        <h2 id="home-start-title">{t("common.homeStartTitle")}</h2>
        <ol>
          <li>
            <h3>{t("common.homeTeamTitle")}</h3>
            <p>{t("common.homeTeamBody")}</p>
            <blockquote>{prompt}</blockquote>
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              {t("common.homeCopyPrompt")}
            </Button>
            {copied !== "idle" && (
              <p role="status">
                {copied === "copied"
                  ? t("common.homePromptCopied")
                  : t("common.homeCopyFailed")}
              </p>
            )}
          </li>
          <li>
            <h3>{t("common.homePlanTitle")}</h3>
            <p>{t("common.homePlanBody")}</p>
          </li>
          <li>
            <h3>{t("common.homeFollowTitle")}</h3>
            <p>{t("common.homeFollowBody")}</p>
          </li>
        </ol>
      </section>
      <nav className="home-destinations" aria-label={t("common.homeExplore")}>
        <Button variant="outline" onClick={() => navigate("/teams")}>
          {t("common.homeOpenTeams")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/agents")}>
          {t("common.homeOpenAgents")}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/?intro=1")}>
          {t("common.homeReviewSetup")}
        </Button>
      </nav>
    </section>
  );
}
