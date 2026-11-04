import { Markdown } from "@/components/markdown";
import { AgentName } from "@/components/names";

const labels: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  specification: "Especificação",
  currentSummary: "Síntese do trabalho",
  previousCurrentSummary: "Síntese anterior",
  progress: "Progresso",
  percent: "Percentual",
  note: "Observação",
  executorAgentId: "Executor",
  previousExecutorAgentId: "Executor anterior",
  authorAgentId: "Autor",
  statusId: "ID do status registrado",
  previousStatusId: "ID do status anterior",
  beforeTaskId: "ID da tarefa seguinte",
  parentId: "ID da tarefa mãe",
  boardId: "ID do board",
  blocked: "Bloqueada",
  reason: "Motivo",
  block: "Bloqueio",
  previous: "Antes",
  changes: "Depois",
  archived: "Arquivada",
  autonomyMode: "Autonomia",
  coordinationContext: "Contexto de coordenação",
  commentId: "ID do comentário",
  planId: "ID do plano",
  revisionId: "ID da revisão",
  revision: "Revisão",
  attachmentId: "ID do arquivo",
  executionSummaryId: "ID do resumo",
  workScope: "Escopo de trabalho",
  projects: "Projetos",
  name: "Nome",
  key: "Chave",
  rootPath: "Pasta local",
  message: "Mensagem",
  content: "Conteúdo",
};
export function asFields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function fieldLabel(key: string) {
  return Object.hasOwn(labels, key)
    ? labels[key]
    : key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}
export function EventValue({
  value,
  field = "",
}: {
  value: unknown;
  field?: string;
}) {
  if (value === undefined || value === null)
    return <span className="small-note">Não informado</span>;
  if (typeof value === "boolean") return <span>{value ? "Sim" : "Não"}</span>;
  if (typeof value === "number")
    return (
      <span>
        {value}
        {field === "percent" ? "%" : ""}
      </span>
    );
  if (typeof value === "string") {
    if (!value) return <span className="small-note">Vazio</span>;
    if (field.endsWith("AgentId"))
      return (
        <span title={value}>
          <AgentName id={value} />
        </span>
      );
    if (field.endsWith("Id") || field === "rootPath")
      return <span className="timeline-literal">{value}</span>;
    if (field === "autonomyMode")
      return (
        <span>
          {value === "manual"
            ? "Manual"
            : value === "automatic"
              ? "Automática"
              : value}
        </span>
      );
    return <Markdown headingOffset={2}>{value}</Markdown>;
  }
  if (Array.isArray(value))
    return value.length ? (
      <ul className="timeline-value-list">
        {value.map((item, index) => (
          <li key={index}>
            <EventValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="small-note">Nenhum item</span>
    );
  return <EventFields data={asFields(value)} />;
}
export function EventFields({ data }: { data: Record<string, unknown> }) {
  return Object.keys(data).length ? (
    <dl className="timeline-event-fields">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{fieldLabel(key)}</dt>
          <dd>
            <EventValue field={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="small-note">Nenhum detalhe adicional registrado.</p>
  );
}
export function ChangedFields({
  previous,
  changes,
}: {
  previous: unknown;
  changes: unknown;
}) {
  const before = asFields(previous),
    after = asFields(changes);
  return Object.keys(after).length ? (
    <div className="timeline-changes">
      {Object.entries(after).map(([key, value]) => (
        <section
          className="task-reading-block"
          key={key}
          aria-label={fieldLabel(key)}
        >
          <h4>{fieldLabel(key)}</h4>
          <div className="timeline-change-values">
            <div>
              <h5>Antes</h5>
              <EventValue field={key} value={before[key]} />
            </div>
            <div>
              <h5>Depois</h5>
              <EventValue field={key} value={value} />
            </div>
          </div>
        </section>
      ))}
    </div>
  ) : (
    <p className="small-note">Campos alterados não registrados neste evento.</p>
  );
}
