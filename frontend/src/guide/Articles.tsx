import { t } from "@/i18n";
import { Section, Snippet } from "./blocks";
import { guideHref } from "./navigation";
import type { Harness } from "@/launch/bootstrap";

export function Articles({
  topic,
  harness,
}: {
  topic: string;
  harness: Harness | null;
}) {
  const link = (page: string, label: string) => (
    <a href={guideHref(page, harness)}>{label}</a>
  );
  if (topic === "about")
    return (
      <>
        <p className="guide-lead">
          {t("guide.beeTeamCoordinatesAIAgentsWorking")}
        </p>
        <Section id="purpose" title={t("guide.whyBeeTeamExists")}>
          <p>{t("guide.aBuildWorkerCanUncoverAn")}</p>
        </Section>
        <Section id="roles" title={t("guide.whoDoesWhat")}>
          <p>{t("guide.yourHarnessRunsTheAgentsThe")}</p>
        </Section>
        <Section id="distribution" title={t("guide.costAndSourceCode")}>
          <p>
            {t("guide.beeTeamIsFreeToUse")}{" "}
            <a href="https://github.com/runvibe/beeteam#license-and-brand">
              {t("guide.licenseAndBrand")}
            </a>
            .
          </p>
        </Section>
      </>
    );
  if (topic === "updates")
    return (
      <>
        <p className="guide-lead">
          {t("guide.checkTheServiceIdentityAndVersion")}
        </p>
        <Section id="version" title={t("guide.readTheServiceVersion")}>
          <Snippet
            label="PowerShell"
            text={
              "Invoke-RestMethod http://127.0.0.1:59865/health\nInvoke-RestMethod http://127.0.0.1:59865/api/v1/info"
            }
          />
          <Snippet
            label="Terminal · macOS / Linux"
            text={
              "curl -fsS http://127.0.0.1:59865/health\ncurl -fsS http://127.0.0.1:59865/api/v1/info"
            }
          />
        </Section>
        <Section id="update" title={t("guide.matchThePanelAndService")}>
          <p>
            {t("guide.thePanelNeedsAMatchingApp")}{" "}
            {link("installation", t("guide.installationSteps"))}
          </p>
        </Section>
      </>
    );
  if (topic === "reference/mcp")
    return (
      <>
        <p className="guide-lead">{t("guide.mcpConnectsYourHarnessToThe")}</p>
        <Section id="discovery" title={t("guide.discoverTheRunningServer")}>
          <p>
            {t("guide.afterInitializationTheClientDiscoversTools")}{" "}
            {link("connect", t("guide.registerAClient"))}
          </p>
        </Section>
        <Section id="first-call" title={t("guide.startWithARead")}>
          <Snippet
            label={t("guide.inTheHarnessChat")}
            text={t("guide.useBeeTeamToCallListBoards")}
          />
          <p>
            {t("guide.anEmptyCollectionIsValidFor")}{" "}
            {link("reference/mcp/tools", t("guide.browseTheToolCatalog"))}
          </p>
        </Section>
      </>
    );
  if (topic === "storage")
    return (
      <>
        <p className="guide-lead">
          {t("guide.beeTeamStoresWorkRecordsLocally")}
        </p>
        <Section id="sqlite" title="SQLite">
          <p>
            {t("guide.theServiceCreatesTheDatabaseIn")} (
            <code>~/.beeteam/beeteam.sql</code>).{" "}
            {t("guide.startTheServiceWithTheSame")}
          </p>
        </Section>
        <Section id="postgres" title="PostgreSQL">
          <p>
            {t("guide.forPostgreSQL18SetDATABASEURL")}{" "}
            {link("reference/environment", t("guide.environmentReference"))}
          </p>
        </Section>
      </>
    );
  return (
    <>
      <p className="guide-lead">{t("guide.startWithTheSymptomYouCan")}</p>
      {[
        [
          t("guide.localServiceUnreachable"),
          t("guide.checkHealthOnTheConfiguredPort"),
        ],
        [
          t("guide.aToolOrSkillIsMissing"),
          t("guide.verifyTheMCPEndpointAndClient"),
        ],
        [t("guide.noDownloadForMyPlatform"), t("guide.checkTheOSAndCPUIf")],
        [
          t("guide.thePanelAsksForAnUpdate"),
          t("guide.compareTheVersionFromApiV1"),
        ],
      ].map(([q, a], i) => (
        <Section
          key={i}
          id={["connection", "discovery", "download", "version"][i]}
          title={q}
        >
          <p>{a}</p>
        </Section>
      ))}
    </>
  );
}
