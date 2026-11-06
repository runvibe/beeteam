import { t, useLocale } from "@/i18n";

export function shouldOfferDesktop(url: URL, installedPwa: boolean) {
  return url.hostname === "getbee.team" && /^\/app\/?$/.test(url.pathname)
    && !url.search && !url.hash && !installedPwa;
}

export function DesktopEntry() {
  const language = useLocale();
  return <main className="desktop-entry" lang={language}>
    <img src="/app/icons/bee-192.png" width="64" height="64" alt="" />
    <h1>{t("common.getBeeTeamBrand")}</h1>
    <a href="beeteam://open">{t("common.desktopOpen")}</a>
    <a href="/app/?web=1">{t("common.desktopContinueWeb")}</a>
    <a href={language === "pt-BR" ? "/pt/guide/" : "/guide/"}>{t("common.guideInstallation")}</a>
  </main>;
}
