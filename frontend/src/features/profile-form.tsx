import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { SaveFeedback } from "./settings";
export function ProfileForm({ agent }: { agent: Agent }) {
  const [name, setName] = useState(agent.name),
    [role, setRole] = useState(agent.roleDescription),
    [style, setStyle] = useState(agent.workStyle),
    [instructions, setInstructions] = useState(agent.workInstructions),
    [rules, setRules] = useState(agent.rules.join("\n")),
    [limits, setLimits] = useState(agent.accessLimits.join("\n")),
    [context, setContext] = useState(agent.contextSummary),
    [image, setImage] = useState(
      agent.image?.kind === "external" ? agent.image.url : "",
    );
  const api = useApi(),
    client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.patch(
        "agents",
        agent.id,
        {
          name,
          roleDescription: role,
          workStyle: style,
          workInstructions: instructions,
          rules: rules.split("\n").filter(Boolean),
          accessLimits: limits.split("\n").filter(Boolean),
          contextSummary: context,
          ...(image
            ? { image: { kind: "external" as const, url: image } }
            : agent.image?.kind === "external"
              ? { image: null }
              : {}),
        },
        agent.version,
      ),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <form
      className="detail-section profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <FieldGroup>
        <h3>Identidade</h3>
        <Field>
          <FieldLabel htmlFor="agent-name">Nome</FieldLabel>
          <Input
            id="agent-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-role">Atuação</FieldLabel>
          <Textarea
            id="agent-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </Field>
        <h3>Orientações de trabalho</h3>
        <Field>
          <FieldLabel htmlFor="agent-style">Estilo de trabalho</FieldLabel>
          <Textarea
            id="agent-style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-instructions">Instruções</FieldLabel>
          <Textarea
            id="agent-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-rules">Regras · uma por linha</FieldLabel>
          <Textarea
            id="agent-rules"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="agent-limits">
            Limites de acesso · um por linha
          </FieldLabel>
          <Textarea
            id="agent-limits"
            value={limits}
            onChange={(e) => setLimits(e.target.value)}
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
            onChange={(e) => setContext(e.target.value)}
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
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={mutation.isPending || !!agent.archivedAt}>
        {mutation.isPending ? "Salvando…" : "Salvar perfil"}
      </Button>
      {agent.archivedAt && (
        <p className="small-note">Perfil arquivado: somente leitura.</p>
      )}
      <SaveFeedback mutation={mutation} />
    </form>
  );
}
