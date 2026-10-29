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
        <h3>Identidade</h3>
        <Field>
          <FieldLabel htmlFor="agent-name">Nome</FieldLabel>
          <Input
            id="agent-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => autosave.change("name", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-role">Atuação</FieldLabel>
          <Textarea
            id="agent-role"
            value={role}
            onChange={(e) => autosave.change("roleDescription", e.target.value)}
          />
        </Field>
        <h3>Orientações de trabalho</h3>
        <Field>
          <FieldLabel htmlFor="agent-style">Estilo de trabalho</FieldLabel>
          <Textarea
            id="agent-style"
            value={style}
            onChange={(e) => autosave.change("workStyle", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-instructions">Instruções</FieldLabel>
          <Textarea
            id="agent-instructions"
            value={instructions}
            onChange={(e) =>
              autosave.change("workInstructions", e.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-rules">Regras · uma por linha</FieldLabel>
          <Textarea
            id="agent-rules"
            value={rules}
            onChange={(e) => autosave.change("rules", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-limits">
            Limites de acesso · um por linha
          </FieldLabel>
          <Textarea
            id="agent-limits"
            value={limits}
            onChange={(e) => autosave.change("accessLimits", e.target.value)}
          />
          <FieldDescription>
            Orientações de atuação; as permissões reais são definidas no
            harness.
          </FieldDescription>
        </Field>
        <h3>Contexto e imagem</h3>
        <Field>
          <FieldLabel htmlFor="agent-context">
            Contexto resumido explícito
          </FieldLabel>
          <Textarea
            id="agent-context"
            value={context}
            onChange={(e) => autosave.change("contextSummary", e.target.value)}
          />
          <FieldDescription>
            Não inclua transcrições de conversas.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-image">URL HTTPS da imagem</FieldLabel>
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
        <p className="small-note">Perfil arquivado: somente leitura.</p>
      )}
      {latest.version > autosave.version && (
        <p role="status" className="small-note">
          Este registro foi atualizado em outra sessão. Seu rascunho foi
          preservado. Use Recarregar formulário após o conflito para descartar o
          rascunho e carregar a versão atual.
        </p>
      )}
      <AutosaveFeedback state={autosave} />
    </form>
  );
}
