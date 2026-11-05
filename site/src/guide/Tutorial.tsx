import { t } from "@/i18n";
import type { Harness } from "@/launch/bootstrap";
import { Section, Snippet } from "./blocks";

const commands = {
  codex: "codex mcp add beeteam --url http://127.0.0.1:59865/mcp",
  "claude-code":
    "claude mcp add --scope local --transport http beeteam http://127.0.0.1:59865/mcp",
  "github-copilot": "/mcp add",
};
export function Tutorial({
  topic,
  harness,
}: {
  topic: string;
  harness: Harness | null;
}) {
  function prompt(
    skill: "get-a-team-lead" | "get-a-worker" | "setup-bee-team",
    request: string,
  ) {
    const name = {
      "get-a-team-lead": "Get a Team Lead",
      "get-a-worker": "Get a Worker",
      "setup-bee-team": "Setup Bee Team",
    }[skill];
    return (
      t("guide.use") +
      (harness === "codex" ? "$" + skill : name) +
      ". " +
      request
    );
  }
  const select = t("guide.chooseYourHarnessAboveToSee");
  const lead = t("guide.inTheLeadChat");
  const worker = t("guide.inASeparateWorkerChat");
  const snippet = (label: string, text: string) =>
    harness ? <Snippet label={label} text={text} /> : <p>{select}</p>;
  if (topic === "connect")
    return (
      <>
        <p className="guide-lead">{t("guide.connectAHarnessRunningOnThe")}</p>
        <Section id="register" title={t("guide.registerTheLocalEndpoint")}>
          <p>{t("guide.startBeeTeamCheckExistingRegistrations")}</p>
          {!harness ? (
            <p>{select}</p>
          ) : harness === "other" ? (
            <p>
              {t("guide.inYourClientSMCPSettings")}{" "}
              <code>http://127.0.0.1:59865/mcp</code>.
            </p>
          ) : (
            <>
              <Snippet
                text={commands[harness]}
                label={
                  harness === "github-copilot"
                    ? "GitHub Copilot CLI"
                    : t("guide.inYourTerminal")
                }
              />
              {harness === "github-copilot" && (
                <p>
                  {t("guide.inTheDialogEnterBeeteamSelect")}{" "}
                  <code>http://127.0.0.1:59865/mcp</code>.
                </p>
              )}
              <Snippet
                label={
                  harness === "github-copilot"
                    ? "GitHub Copilot CLI"
                    : t("guide.inYourTerminal")
                }
                text={
                  harness === "github-copilot"
                    ? "/mcp"
                    : harness === "codex"
                      ? "codex mcp list"
                      : "claude mcp list"
                }
              />
            </>
          )}
        </Section>
        <Section id="verify" title={t("guide.checkTheConnection")}>
          {snippet(
            t("guide.inYourHarnessChat"),
            t("guide.discoverTheBeeTeamToolsAnd"),
          )}
          <p>{t("guide.anEmptyListIsASuccessful")}</p>
        </Section>
      </>
    );
  if (topic === "first-team")
    return (
      <>
        <p className="guide-lead">{t("guide.prepareAReleaseWithTwoWorkers")}</p>
        <Section id="start-the-lead" title={t("guide.startTheLeadChat")}>
          {snippet(
            lead,
            prompt("get-a-team-lead", t("guide.createAReleaseTeamForThis")),
          )}
        </Section>
        <Section id="register-workers" title={t("guide.giveEachWorkerAChat")}>
          <p>{t("guide.useTheFirstPromptInThe")}</p>
          {snippet(
            worker,
            prompt("get-a-worker", t("guide.registerAsTheReleaseNotesWorker")),
          )}
          {snippet(
            worker,
            prompt(
              "get-a-worker",
              t("guide.registerAsTheBuildVerificationWorker"),
            ),
          )}
        </Section>
      </>
    );
  if (topic === "parallel-tasks")
    return (
      <>
        <p className="guide-lead">{t("guide.giveEachWorkerADeliverableIt")}</p>
        <Section id="assign" title={t("guide.assignBothTasks")}>
          {snippet(lead, t("guide.createTwoTasksInTheRelease"))}
        </Section>
        <Section id="dispatch" title={t("guide.workInParallel")}>
          <p>{t("guide.openBothAssignedChatsEachWorker")}</p>
        </Section>
      </>
    );
  return (
    <>
      <p className="guide-lead">
        {t("guide.reviewRecordedEvidenceOnTheBoard")}
      </p>
      <Section id="dependency" title={t("guide.resolveADependency")}>
        <p>{t("guide.ifTheBuildFailsRecordThe")}</p>
      </Section>
      <Section id="review" title={t("guide.reviewBothResults")}>
        {snippet(lead, t("guide.compareTheReleaseNotesWithThe"))}
        <p>{t("guide.openEachTaskToSeeIts")}</p>
      </Section>
    </>
  );
}
