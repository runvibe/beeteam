import { t } from "@/i18n";
import { useState } from "react";
import { appVersion } from "@/app-version";
import { bootstrapCommand, type Harness } from "@/launch/bootstrap";
import { usePublicManifest } from "@/launch/public-manifest";
import { Section, Snippet } from "./blocks";

export function Installation({ harness }: { harness: Harness | null }) {
  const [os, setOs] = useState("windows"),
    [arch, setArch] = useState("x64");
  const manifest = usePublicManifest();
  const release =
    manifest.data?.appVersion === appVersion ? manifest.data : undefined;
  const artifact = release?.artifacts.find(
    (a) =>
      a.os === os &&
      a.arch === arch &&
      /^[a-z\d][a-z\d._-]*$/i.test(a.fileName) &&
      release.skills.repository === "https://github.com/runvibe/beeteam" &&
      a.url ===
        release.skills.repository +
          "/releases/download/v" +
          release.appVersion +
          "/" +
          a.fileName,
  );
  const command =
    harness && release ? bootstrapCommand(release, harness) : null;
  return (
    <>
      <p className="guide-lead">{t("guide.runTheServiceOnTheComputer")}</p>
      <Section id="download" title={t("guide.getTheBinary")}>
        <div className="guide-selects">
          <label>
            {t("guide.operatingSystem")}
            <select value={os} onChange={(e) => setOs(e.target.value)}>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
              <option value="macos">macOS</option>
            </select>
          </label>
          <label>
            {t("guide.architecture")}
            <select value={arch} onChange={(e) => setArch(e.target.value)}>
              <option>x64</option>
              <option>arm64</option>
            </select>
          </label>
        </div>
        {artifact ? (
          <>
            <a href={artifact.url}>
              {t("guide.download")} {artifact.fileName}
            </a>
            <p>
              SHA-256: <code>{artifact.sha256}</code> · {t("guide.byteSize", { count: artifact.size })}
            </p>
            <p>{t("guide.compareTheArchiveSizeAndSHA")}</p>
            <Snippet
              label={t("guide.checkTheArchive")}
              text={
                (os === "windows"
                  ? "Get-FileHash -Algorithm SHA256 "
                  : os === "macos"
                    ? "shasum -a 256 "
                    : "sha256sum ") + JSON.stringify(artifact.fileName)
              }
            />
          </>
        ) : (
          <p role="status">
            {manifest.isPending
              ? t("guide.checkingTheReleaseManifest")
              : t("guide.aVerifiedArchiveForThisVersion")}
          </p>
        )}
      </Section>
      <Section id="build" title={t("guide.buildFromSource")}>
        <p>
          {t("guide.fromACheckoutOfTheMatching")}{" "}
          <a href="https://github.com/runvibe/beeteam">
            {t("guide.sourceRepository")}
          </a>
          .
        </p>
        <Snippet
          label={t("guide.terminalRepositoryRoot")}
          text="node scripts/build-distribution.mjs"
        />
        <p>{t("guide.theExecutableIsWrittenToTarget")}</p>
      </Section>
      <Section id="start" title={t("guide.startTheLocalApp")}>
        <p>{t("guide.runTheBinaryDirectlyForAPI")}</p>
        <Snippet
          label={os === "windows" ? "PowerShell" : "Terminal"}
          text={
            os === "windows"
              ? "$env:BEE_FRONTEND_MODE = 'embedded'\n.\\target\\release\\beeteam.exe"
              : "BEE_FRONTEND_MODE=embedded ./target/release/beeteam"
          }
        />
        <p>
          {t("guide.openTheLocalPanel")}{" "}
          <a href="http://127.0.0.1:59865/app/">127.0.0.1:59865/app/</a>.
        </p>
      </Section>
      <Section id="skills" title={t("guide.installTheThreeSkills")}>
        <p>{t("guide.setupBeeTeamHandlesInstallationAnd")}</p>
        {command ? (
          <Snippet label={t("guide.projectTerminal")} text={command} />
        ) : harness && harness !== "other" ? (
          <>
            <p>{t("guide.forASourceInstallationRunThis")}</p>
            <Snippet
              label="Terminal"
              text={
                "npx skills@1.7.6 add ./skills --skill setup-bee-team get-a-team-lead get-a-worker -a " +
                harness +
                " --copy"
              }
            />
          </>
        ) : (
          <p>{t("guide.selectAHarnessForItsCommand")}</p>
        )}
        <p>
          {t("guide.refreshTheHarnessAndConfirmAll")}{" "}
          <a href="/install">{t("guide.fullSetupInstructions")}</a>
        </p>
        {harness && (
          <Snippet
            label={t("guide.inYourHarnessChat")}
            text={
              (harness === "codex" ? "$setup-bee-team" : "Setup Bee Team") +
              ": " +
              t("guide.checkTheInstallationAndConfirmThe")
            }
          />
        )}
      </Section>
    </>
  );
}
