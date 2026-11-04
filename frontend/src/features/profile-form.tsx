import { useLocale, t as tr } from "@/i18n";

import {
  useSettingsAutosave,
  AutosaveFeedback,
} from "@/components/settings-autosave";
import { useApi } from "@/api/context";
import type { Agent } from "@/api/types";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function ProfileForm({ agent: latest }: { agent: Agent }) {
  useLocale();
  const api = useApi();
  const autosave = useSettingsAutosave({
    resource: "agents",
    load: () => api.get("agents", latest.id),
    latest,
    values: (agent: Agent) => ({
      name: agent.name,
      roleDescription: agent.roleDescription,
      workStyle: agent.workStyle,
      workInstructions: agent.workInstructions,
      rules: agent.rules.join("\n"),
      accessLimits: agent.accessLimits.join("\n"),
      contextSummary: agent.contextSummary,
      image: agent.image?.kind === "external" ? agent.image.url : "",
    }),
    save: (draft, version) =>
      api.patch(
        "agents",
        latest.id,
        {
          name: draft.name,
          roleDescription: draft.roleDescription,
          workStyle: draft.workStyle,
          workInstructions: draft.workInstructions,
          contextSummary: draft.contextSummary,
          rules: draft.rules.split("\n").filter(Boolean),
          accessLimits: draft.accessLimits.split("\n").filter(Boolean),
          ...(draft.image
            ? { image: { kind: "external" as const, url: draft.image } }
            : latest.image?.kind === "external"
              ? { image: null }
              : {}),
        },
        version,
      ),
  });
  const {
    name,
    roleDescription: role,
    workStyle: style,
    workInstructions: instructions,
    rules,
    accessLimits: limits,
    contextSummary: context,
    image,
  } = autosave.draft;
  const agent = latest;
  return (
    <form className="detail-section profile-form" {...autosave.formProps}>
      <FieldGroup>
        <h3>{tr("agents.identity")}</h3>
        <Field>
          <FieldLabel htmlFor="agent-name">{tr("agents.name")}</FieldLabel>
          <Input
            id="agent-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => autosave.change("name", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-role">{tr("agents.activity")}</FieldLabel>
          <Textarea
            id="agent-role"
            value={role}
            onChange={(e) => autosave.change("roleDescription", e.target.value)}
          />
        </Field>
        <h3>{tr("agents.workGuidelines")}</h3>
        <Field>
          <FieldLabel htmlFor="agent-style">
            {tr("agents.workingStyle")}
          </FieldLabel>
          <Textarea
            id="agent-style"
            value={style}
            onChange={(e) => autosave.change("workStyle", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-instructions">
            {tr("agents.instructions")}
          </FieldLabel>
          <Textarea
            id="agent-instructions"
            value={instructions}
            onChange={(e) =>
              autosave.change("workInstructions", e.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-rules">
            {tr("agents.rulesOnePerLine")}
          </FieldLabel>
          <Textarea
            id="agent-rules"
            value={rules}
            onChange={(e) => autosave.change("rules", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-limits">
            {tr("agents.accessLimitsOnePerLine")}
          </FieldLabel>
          <Textarea
            id="agent-limits"
            value={limits}
            onChange={(e) => autosave.change("accessLimits", e.target.value)}
          />
          <FieldDescription>
            {tr("agents.workGuidelinesActualPermissionsAreDefinedInTheHarness")}
          </FieldDescription>
        </Field>
        <h3>{tr("agents.contextAndImage")}</h3>
        <Field>
          <FieldLabel htmlFor="agent-context">
            {tr("agents.explicitBriefContext")}
          </FieldLabel>
          <Textarea
            id="agent-context"
            value={context}
            onChange={(e) => autosave.change("contextSummary", e.target.value)}
          />
          <FieldDescription>
            {tr("agents.doNotIncludeConversationTranscripts")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-image">
            {tr("agents.imageHttpsUrl")}
          </FieldLabel>
          <Input
            id="agent-image"
            type="url"
            pattern="https://.*"
            value={image}
            onChange={(e) => autosave.change("image", e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </FieldGroup>
      {agent.archivedAt && (
        <p className="small-note">{tr("agents.archivedProfileReadOnly")}</p>
      )}
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          {tr("agents.thisRecordWasUpdatedInAnotherSessionYourDraftWas")}
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
