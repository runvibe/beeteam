import { useSiteLink } from "@/state/site-link";
import { BookOpen, Columns3, Network, Users } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { t, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useApiCompatibility } from "@/api/compatibility";
import { navigate, safeOrigin, useLocation } from "@/routing/location";
import "./connected-home.css";

export function ConnectedHome() {
  const siteLink = useSiteLink();
  const locale = useLocale();
  const url = useLocation();
  const { info } = useApiCompatibility();
  const origin = safeOrigin(new URLSearchParams(url.split("?")[1]).get("from"));
  const resume =
    origin && !new URL(origin, location.origin).pathname.startsWith("/home")
      ? origin
      : null;
  const prompt = t("common.homeLeaderPrompt");
  return (
    <section className="connected-home" aria-labelledby="home-title">
      <header>
        <p className="small-note">
          {info
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
            <CopyButton variant="outline" size="sm" text={prompt} label={t("common.homeCopyPrompt")} />
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
        <Button asChild variant="outline"><a href={siteLink("/guide/")}><BookOpen aria-hidden="true" />{t("common.guideDocumentation")}</a></Button>
        <Button variant="outline" onClick={() => navigate("/teams")}>
          <Network aria-hidden="true" />{t("common.homeOpenTeams")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/agents")}>
          <Users aria-hidden="true" />{t("common.homeOpenAgents")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/boards")}><Columns3 aria-hidden="true" />{t("common.homeViewBoards")}</Button>
        <Button asChild variant="ghost">
          <a href={siteLink(`${locale === "pt-BR" ? "/pt" : ""}/guide/installation`)}>{t("common.homeReviewSetup")}</a>
        </Button>
      </nav>
    </section>
  );
}
