import React from "react";
import { renderToString } from "react-dom/server";
import { escapeInject, dangerouslySkipEscape } from "vike/server";
import { Page } from "../src/Page";
import { configureLocale, t } from "../src/i18n";
import { pages } from "../src/guide/navigation";

export function onRenderHtml(ctx: { urlPathname: string }) {
  const path = ctx.urlPathname,
    pt = path.startsWith("/pt/");
  configureLocale(path);
  let english = path.replace(/^\/pt(?=\/|$)/, "") || "/";
  const topic =
    english.replace(/^\/guide\/?/, "").replace(/\/$/, "") || "about";
  if (english === "/guide/about") english = "/guide/";
  if (!english.endsWith("/")) english += "/";
  const canonical = (pt ? "/pt" : "") + english;
  const item = pages.find((p) => p[0] === topic);
  const title =
    (english === "/"
      ? t("common.launchFooter")
      : item
        ? t(item[1])
        : t("guide.documentation")) + " | Bee Team";
  const descriptions: Record<string, string> = {
    about: "guide.beeTeamCoordinatesAIAgentsWorking",
    installation: "guide.runTheServiceOnTheComputer",
    connect: "guide.connectAHarnessRunningOnThe",
    "first-team": "guide.prepareAReleaseWithTwoWorkers",
    "parallel-tasks": "guide.giveEachWorkerADeliverableIt",
    review: "guide.reviewRecordedEvidenceOnTheBoard",
    storage: "guide.beeTeamStoresWorkRecordsLocally",
    updates: "guide.checkTheServiceIdentityAndVersion",
    troubleshooting: "guide.startWithTheSymptomYouCan",
  };
  const description =
    english === "/"
      ? t("common.launchLead")
      : descriptions[topic]
        ? t(descriptions[topic])
        : title + ". " + t("guide.beeTeamCoordinatesAIAgentsWorking");
  const html = renderToString(<Page path={path} />);
  return escapeInject`<!DOCTYPE html><html lang="${pt ? "pt" : "en"}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><meta name="description" content="${description}"/><link rel="canonical" href="${"https://getbee.team" + canonical}"/><link rel="alternate" hreflang="en" href="${"https://getbee.team" + english}"/><link rel="alternate" hreflang="pt" href="${"https://getbee.team/pt" + english}"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${"https://getbee.team" + canonical}"/></head><body><div id="site-root">${dangerouslySkipEscape(html)}</div></body></html>`;
}
