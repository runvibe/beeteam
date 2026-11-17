# Resumos de raciocínio no chat — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no chat gerenciado os resumos de raciocínio do Codex enquanto o agente trabalha, recolhê-los automaticamente ao final e mantê-los disponíveis, discretos, no histórico.

**Architecture:** O adaptador Codex (`repositories/codex_integrated`) acumula apenas os eventos de *resumo* de raciocínio em um novo `IntegratedEvent::Reasoning(String)` cumulativo. O serviço de execução gerenciada persiste esse texto no campo `reasoning` da mensagem do agente da requisição (limite de 16 KiB), que passa a fazer parte da projeção pública da mensagem e dos contratos HTTP/MCP. No frontend, `AgentMessage` renderiza um `<details>` discreto, aberto enquanto a requisição está ativa e fechado automaticamente quando ela termina.

**Tech Stack:** Rust (axum, tokio, serde_json), Codex App Server JSON-RPC, React + TypeScript, Vitest/Testing Library, openapi-typescript.

## Global Constraints

- Exibir somente **resumos** (`item/reasoning/summaryTextDelta`, `item/reasoning/summaryPartAdded`, item `reasoning` concluído → `summary`). Nunca persistir nem exibir `item/reasoning/textDelta` nem o campo `content` do item de raciocínio.
- Limite do campo `reasoning`: 16384 bytes UTF-8, truncado em fronteira de caractere com aviso final `\n[Reasoning shortened to the 16384-byte display limit.]`.
- O texto é Markdown exibido pelo componente `Markdown` existente; nunca executar nem renderizar HTML bruto.
- Emissão do adaptador com throttle de 250 ms; o evento final (item concluído) é sempre emitido.
- `reasoning` ausente ou vazio ⇒ nenhuma área é exibida (modelos/configs sem resumo continuam iguais).
- Leader chat legado e entrega para workers ignoram o novo evento.
- Camadas: protocolo só em `repositories/`, regra/limite em `services/`, contrato em `docs/proposals` + catálogo MCP; nenhum arquivo acima de 1000 linhas (`codex_integrated.rs` já tem 786 — a lógica nova vai para um submódulo).
- HTTP e MCP compartilham a mesma projeção; regenerar `docs/mcp-catalog.json` com `cargo run --locked --features mcp --example mcp_catalog`.
- Mudança visível ⇒ atualizar `CHANGELOG.md` (Unreleased, em inglês) e `README.md`.
- Validar com `cargo build`, `cargo test` (SQLite: `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false`) e `npm test` no `frontend/`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/repositories/integrated_provider.rs` | Nova variante `IntegratedEvent::Reasoning(String)` |
| `src/repositories/codex_integrated/reasoning.rs` (novo) | Acumulador puro `ReasoningSummary` dos eventos de resumo |
| `src/repositories/codex_integrated.rs` | Encaminhar notificações de resumo ao acumulador e emitir com throttle |
| `src/services/managed_agents/execution.rs` | Persistir `reasoning` limitado na mensagem do agente |
| `src/services/managed_agents/mod.rs` | Projetar `reasoning` na mensagem pública |
| `src/services/leader_chat/execution.rs`, `worker_delivery.rs` | Ignorar `Reasoning` |
| `docs/proposals/managed-agents-openapi.json`, `managed-agents-mcp.json`, `docs/mcp-catalog.json`, `frontend/src/api/generated/managed-agents.ts` | Contrato `reasoning: string \| null` na mensagem |
| `tests/managed_fixture/mod.rs`, `tests/managed_agent_http.rs` | Provedor de teste `think` e teste HTTP/snapshot |
| `frontend/src/features/managed-agent-reasoning.tsx` (novo) | Componente `MessageReasoning` recolhível |
| `frontend/src/features/managed-agent-chat-parts.tsx`, `managed-agent-history.tsx` | Passar `active` até a mensagem do agente |
| `frontend/src/features/managed-agent-chat.css` | Estilo discreto |
| `frontend/src/i18n/catalogs/managed.{en,pt}.json` | Rótulos |
| `README.md`, `CHANGELOG.md` | Documentação |

---

### Task 1: Acumulador de resumos e evento do provider

**Files:**
- Modify: `src/repositories/integrated_provider.rs:21-46`
- Create: `src/repositories/codex_integrated/reasoning.rs`
- Modify: `src/repositories/codex_integrated.rs` (declaração `mod reasoning;` junto de `mod images;`; loop de notificações ~542-625)
- Modify: `src/services/leader_chat/execution.rs:245`, `src/services/leader_chat/worker_delivery.rs:282`, `src/services/managed_agents/execution.rs:246` (arms vazios temporários para compilar)

**Interfaces:**
- Produces: `IntegratedEvent::Reasoning(String)` — texto Markdown cumulativo de todos os resumos da requisição até o momento.
- Produces: `pub(super) struct ReasoningSummary` com `delta(&mut self, item: &str, index: usize, delta: &str)`, `part(&mut self, item: &str, index: usize)`, `complete(&mut self, item: &str, summary: Vec<String>)`, `text(&self) -> String`, `is_empty(&self) -> bool`.

- [ ] **Step 1: Confirmar o formato do protocolo local**

Run: `"$BEE_CODEX_EXECUTABLE" app-server generate-json-schema --out /tmp/codex-schema && grep -l -r "summaryTextDelta\|ReasoningSummaryPartAdded" /tmp/codex-schema | head`
Expected: parâmetros `{threadId, turnId, itemId, delta, summaryIndex}` para `summaryTextDelta`, `{threadId, turnId, itemId, summaryIndex}` para `summaryPartAdded`, e item `{type:"reasoning", id, summary:[string], content:[string]}`. Se os nomes diferirem, ajuste os campos lidos no Step 5 e apague `/tmp/codex-schema`.

- [ ] **Step 2: Escrever os testes do acumulador**

Crie `src/repositories/codex_integrated/reasoning.rs` só com os testes:

```rust
#[cfg(test)]
mod tests {
    use super::ReasoningSummary;

    #[test]
    fn joins_parts_and_items_in_arrival_order() {
        let mut s = ReasoningSummary::default();
        assert!(s.is_empty());
        s.delta("a", 0, "**Plan** ");
        s.delta("a", 0, "steps");
        s.part("a", 1);
        s.delta("a", 1, "Check files");
        s.delta("b", 0, "Next item");
        assert_eq!(s.text(), "**Plan** steps\n\nCheck files\n\nNext item");
    }

    #[test]
    fn completed_item_replaces_streamed_parts() {
        let mut s = ReasoningSummary::default();
        s.delta("a", 0, "partial");
        s.complete("a", vec!["Final one".into(), "Final two".into()]);
        assert_eq!(s.text(), "Final one\n\nFinal two");
    }

    #[test]
    fn empty_parts_are_skipped() {
        let mut s = ReasoningSummary::default();
        s.part("a", 0);
        s.complete("b", vec![String::new()]);
        assert!(s.is_empty());
        assert_eq!(s.text(), "");
    }
}
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cargo test --lib reasoning::tests`
Expected: FAIL — `ReasoningSummary` não existe (adicione `mod reasoning;` em `codex_integrated.rs` para o arquivo ser compilado).

- [ ] **Step 4: Implementar o acumulador**

Acima do bloco de testes:

```rust
/// Cumulative Codex reasoning *summaries* for one turn; raw reasoning is never stored here.
#[derive(Default)]
pub(super) struct ReasoningSummary {
    items: Vec<(String, Vec<String>)>,
}

impl ReasoningSummary {
    fn parts(&mut self, item: &str, index: usize) -> &mut String {
        let pos = match self.items.iter().position(|(id, _)| id == item) {
            Some(pos) => pos,
            None => {
                self.items.push((item.to_owned(), Vec::new()));
                self.items.len() - 1
            }
        };
        let parts = &mut self.items[pos].1;
        if parts.len() <= index {
            parts.resize(index + 1, String::new());
        }
        &mut parts[index]
    }
    pub(super) fn delta(&mut self, item: &str, index: usize, delta: &str) {
        self.parts(item, index).push_str(delta);
    }
    pub(super) fn part(&mut self, item: &str, index: usize) {
        self.parts(item, index);
    }
    pub(super) fn complete(&mut self, item: &str, summary: Vec<String>) {
        match self.items.iter_mut().find(|(id, _)| id == item) {
            Some((_, parts)) => *parts = summary,
            None => self.items.push((item.to_owned(), summary)),
        }
    }
    pub(super) fn text(&self) -> String {
        self.items
            .iter()
            .flat_map(|(_, parts)| parts.iter())
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n")
    }
    pub(super) fn is_empty(&self) -> bool {
        self.text().is_empty()
    }
}
```

- [ ] **Step 5: Adicionar a variante e ligar no loop do adaptador**

Em `integrated_provider.rs`, dentro de `enum IntegratedEvent`, após `Text(String),`:

```rust
    /// Cumulative Markdown reasoning summary for the turn (never raw reasoning).
    Reasoning(String),
```

Em `codex_integrated.rs`, perto de `let mut texts` / `last_emit` no início do loop do turno:

```rust
let mut reasoning = reasoning::ReasoningSummary::default();
let mut last_reasoning = std::time::Instant::now() - Duration::from_secs(1);
```

E no `match method`, antes de `"turn/completed"`:

```rust
"item/reasoning/summaryTextDelta" => {
    reasoning.delta(
        p["itemId"].as_str().unwrap_or("reasoning"),
        p["summaryIndex"].as_u64().unwrap_or(0) as usize,
        p["delta"].as_str().unwrap_or(""),
    );
    if last_reasoning.elapsed() >= Duration::from_millis(250) && !reasoning.is_empty() {
        emit(&events, IntegratedEvent::Reasoning(reasoning.text())).await?;
        last_reasoning = std::time::Instant::now();
    }
}
"item/reasoning/summaryPartAdded" => reasoning.part(
    p["itemId"].as_str().unwrap_or("reasoning"),
    p["summaryIndex"].as_u64().unwrap_or(0) as usize,
),
"item/completed" if p["item"]["type"] == "reasoning" => {
    let summary = p["item"]["summary"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str().map(str::to_owned))
        .collect();
    reasoning.complete(p["item"]["id"].as_str().unwrap_or("reasoning"), summary);
    if !reasoning.is_empty() {
        emit(&events, IntegratedEvent::Reasoning(reasoning.text())).await?;
        last_reasoning = std::time::Instant::now();
    }
}
```

`item/reasoning/textDelta` continua caindo em `_ => {}` de propósito.

Adicione arms temporários para o código compilar:
- `leader_chat/execution.rs` (junto de `IntegratedEvent::Image { .. } => {}`): `IntegratedEvent::Reasoning(_) => {}`
- `leader_chat/worker_delivery.rs:282`: `IntegratedEvent::Tool { .. } | IntegratedEvent::Image { .. } | IntegratedEvent::Reasoning(_) => {}`
- `managed_agents/execution.rs:246`: `IntegratedEvent::Tool { .. } | IntegratedEvent::Reasoning(_) => {}` (Task 2 substitui)

- [ ] **Step 6: Rodar testes e build**

Run: `cargo test --lib reasoning::tests && cargo build`
Expected: 3 testes PASS; build OK.

- [ ] **Step 7: Commit**

```bash
git add src/repositories src/services/leader_chat src/services/managed_agents/execution.rs
git commit -m "feat(codex): capture reasoning summaries as provider events"
```

---

### Task 2: Persistência, projeção e contrato HTTP/MCP

**Files:**
- Modify: `src/services/managed_agents/execution.rs` (arm de `persist` ~246; helpers perto de `save_text` ~391 e `bounded_text` ~440)
- Modify: `src/services/managed_agents/mod.rs:117-126`
- Modify: `tests/managed_fixture/mod.rs` (~167, junto de `"draw"`)
- Test: `tests/managed_agent_http.rs`
- Modify: `docs/proposals/managed-agents-openapi.json`, `docs/proposals/managed-agents-mcp.json`, `docs/mcp-catalog.json`, `frontend/src/api/generated/managed-agents.ts`

**Interfaces:**
- Consumes: `IntegratedEvent::Reasoning(String)` (Task 1).
- Produces: mensagem pública do agente com `reasoning: string | null` em snapshot, listagem de mensagens HTTP e ferramentas MCP equivalentes.

- [ ] **Step 1: Fazer o provedor de teste emitir resumos**

Em `tests/managed_fixture/mod.rs`, logo antes de `if text == "draw" {`:

```rust
if text == "think" {
    for summary in ["**Plan** steps", "**Plan** steps\n\nRaw-free summary"] {
        events
            .send(IntegratedEvent::Reasoning(summary.into()))
            .await
            .unwrap();
    }
}
```

- [ ] **Step 2: Escrever o teste HTTP**

No fim de `tests/managed_agent_http.rs`:

```rust
#[tokio::test]
async fn reasoning_summaries_are_kept_on_the_agent_message() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"think"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let requester = &snapshot["messages"]["items"][0];
    let agent_message = &snapshot["messages"]["items"][1];
    assert_eq!(agent_message["content"], "Response");
    assert_eq!(agent_message["reasoning"], "**Plan** steps\n\nRaw-free summary");
    assert!(requester["reasoning"].is_null(), "{requester}");
}

#[tokio::test]
async fn messages_without_reasoning_expose_null() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"hello"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    assert!(snapshot["messages"]["items"][1]["reasoning"].is_null());
}
```

E um teste unitário do limite no fim de `src/services/managed_agents/execution.rs`:

```rust
#[cfg(test)]
mod reasoning_tests {
    #[test]
    fn reasoning_is_bounded_on_a_char_boundary() {
        let text = super::bounded_reasoning("é".repeat(9000));
        assert!(text.len() <= 16384);
        assert!(text.ends_with("[Reasoning shortened to the 16384-byte display limit.]"));
    }
}
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --test managed_agent_http reasoning && cargo test --lib reasoning_tests`
Expected: FAIL — `reasoning` é `null`/ausente e `bounded_reasoning` não existe.

- [ ] **Step 4: Persistir na mensagem do agente**

Em `execution.rs`, substitua o arm temporário por:

```rust
IntegratedEvent::Reasoning(text) => save_reasoning(&mut u.records, &r, text)?,
IntegratedEvent::Tool { .. } => {}
```

Ao lado de `save_text`/`bounded_text`:

```rust
fn save_reasoning(records: &mut Records, request: &Record, text: String) -> Result<()> {
    let text = bounded_reasoning(text);
    let mid = match agent_message(records, request.id) {
        Some(mid) => mid,
        None => {
            let m = Record::new(
                "managed_messages",
                json!({"conversationId":request.data["conversationId"],"requestId":request.id,"role":"agent","content":""}),
            );
            let mid = m.id;
            records.insert(m);
            mid
        }
    };
    let m = records.get_mut("managed_messages", mid)?;
    m.data["reasoning"] = json!(text);
    m.touch();
    Ok(())
}
fn bounded_reasoning(mut text: String) -> String {
    const LIMIT: usize = 16384;
    const NOTICE: &str = "\n[Reasoning shortened to the 16384-byte display limit.]";
    if text.len() > LIMIT {
        let mut end = LIMIT - NOTICE.len();
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        text.push_str(NOTICE);
    }
    text
}
```

Se `attach_image` (~419) duplicar a criação da mensagem vazia, extraia `fn ensure_agent_message(records: &mut Records, request: &Record) -> Uuid` e use-o nos dois lugares.

- [ ] **Step 5: Projetar o campo**

Em `mod.rs`, dentro de `if r.table == "managed_messages" {`, após o bloco de `images`:

```rust
v["reasoning"] = match r.data["reasoning"].as_str() {
    Some(text) if !text.is_empty() => json!(text),
    _ => Value::Null,
};
```

- [ ] **Step 6: Rodar os testes**

Run: `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --test managed_agent_http reasoning messages_without_reasoning && cargo test --lib reasoning_tests`
Expected: PASS.

- [ ] **Step 7: Atualizar o contrato**

Em cada schema de mensagem que já declara `"images"` (`docs/proposals/managed-agents-openapi.json`, componente da mensagem; `docs/proposals/managed-agents-mcp.json`, nas três ocorrências ~1313, ~1618, ~3268), adicione ao lado de `images`:

```json
"reasoning": {
  "description": "Cumulative reasoning summary shown collapsed in chat. Never contains raw model reasoning.",
  "anyOf": [
    { "type": "string", "maxLength": 16384, "x-maxBytes": 16384 },
    { "type": "null" }
  ]
}
```

Run:
```bash
node docs/proposals/validate-managed-agents.mjs --write
cargo run --locked --features mcp --example mcp_catalog
git diff --stat docs frontend/src/api/generated
```
Expected: validador sem drift; `frontend/src/api/generated/managed-agents.ts` passa a ter `reasoning?: string | null`; `docs/mcp-catalog.json` atualizado.

- [ ] **Step 8: Suite completa e build**

Run: `cargo build && BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test`
Expected: PASS (inclui `tests/managed_agent_contract.rs` e paridade MCP).

- [ ] **Step 9: Commit**

```bash
git add src tests docs frontend/src/api/generated
git commit -m "feat(chat): persist reasoning summaries on agent messages"
```

---

### Task 3: Área de raciocínio recolhível no chat

**Files:**
- Create: `frontend/src/features/managed-agent-reasoning.tsx`
- Modify: `frontend/src/features/managed-agent-chat-parts.tsx:158-228` (`AgentMessage`, `ChatMessage`)
- Modify: `frontend/src/features/managed-agent-history.tsx:77-84`
- Modify: `frontend/src/features/managed-agent-chat.css`
- Modify: `frontend/src/i18n/catalogs/managed.en.json`, `managed.pt.json`
- Test: `frontend/src/features/managed-agent-chat-parts.test.tsx`

**Interfaces:**
- Consumes: `message.reasoning?: string | null` (Task 2).
- Produces: `MessageReasoning({ text: string; active: boolean })`; `ChatMessage` aceita `active?: boolean`.

- [ ] **Step 1: Escrever os testes**

Em `managed-agent-chat-parts.test.tsx`, acrescente:

```tsx
const reasoningMessage = {
  id: ids.message,
  conversationId: ids.conversation,
  requestId: ids.message,
  role: "agent" as const,
  content: "Done",
  reasoning: "**Plan** steps",
  images: [],
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
};

it("keeps reasoning open while the request is active and collapses it when done", async () => {
  await i18n.changeLanguage("en");
  const { rerender, container } = render(
    <ChatMessage message={reasoningMessage} active />,
  );
  const details = container.querySelector("details.assistant-reasoning")!;
  expect(details).toHaveAttribute("open");
  expect(screen.getByText("Thinking…")).toBeInTheDocument();
  rerender(<ChatMessage message={reasoningMessage} active={false} />);
  expect(details).not.toHaveAttribute("open");
  expect(screen.getByText("Reasoning")).toBeInTheDocument();
  expect(screen.getByText("Plan")).toBeInTheDocument();
});

it("lets the user reopen collapsed reasoning from history", async () => {
  await i18n.changeLanguage("en");
  const { container } = render(<ChatMessage message={reasoningMessage} />);
  const details = container.querySelector("details.assistant-reasoning")!;
  expect(details).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Reasoning"));
  expect(details).toHaveAttribute("open");
});

it("renders nothing when there is no reasoning", () => {
  const { container } = render(
    <ChatMessage message={{ ...reasoningMessage, reasoning: null }} active />,
  );
  expect(container.querySelector("details.assistant-reasoning")).toBeNull();
});
```

Atualize o import: `import { render, screen, fireEvent } from "@testing-library/react";`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/features/managed-agent-chat-parts.test.tsx`
Expected: FAIL — `details.assistant-reasoning` inexistente.

- [ ] **Step 3: Criar o componente**

`frontend/src/features/managed-agent-reasoning.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { t } from "@/i18n";

/** Collapsible, low-emphasis reasoning summary: open while active, collapsed afterwards. */
export function MessageReasoning({ text, active }: { text: string; active: boolean }) {
  const [open, setOpen] = useState(active);
  useEffect(() => setOpen(active), [active]);
  return (
    <details
      className="assistant-reasoning"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <Brain aria-hidden="true" />
        {active ? t("managed.reasoningActive") : t("managed.reasoning")}
      </summary>
      <div className="assistant-reasoning-body">
        <Markdown>{text}</Markdown>
      </div>
    </details>
  );
}
```

Confirme os caminhos de import de `Markdown` e `t` copiando os usados no topo de `managed-agent-chat-parts.tsx`.

- [ ] **Step 4: Ligar em `AgentMessage`/`ChatMessage`/histórico**

Em `managed-agent-chat-parts.tsx`:
- `AgentMessage` recebe `active?: boolean` e, como primeiro filho de `.assistant-msg-body`:

```tsx
{message.reasoning ? (
  <MessageReasoning text={message.reasoning} active={!!active} />
) : null}
```
- `ChatMessage` recebe `active?: boolean` e repassa: `<AgentMessage message={message} onRecover={onRecover} busy={busy} active={active} />`.

Em `managed-agent-history.tsx`, no `messages.map`:

```tsx
<ChatMessage
  key={message.id}
  message={message}
  busy={busy}
  active={
    !!current &&
    message.requestId === current.id &&
    ["queued", "preparing", "running", "awaiting_approval"].includes(current.state)
  }
  onRecover={() => onRecover(message)}
/>
```

- [ ] **Step 5: Textos e estilo discreto**

`managed.en.json`: `"reasoning": "Reasoning"`, `"reasoningActive": "Thinking…"`.
`managed.pt.json`: `"reasoning": "Raciocínio"`, `"reasoningActive": "Pensando…"`.

`managed-agent-chat.css`:

```css
.assistant-reasoning {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.assistant-reasoning > summary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  list-style: none;
  opacity: 0.75;
}
.assistant-reasoning > summary::-webkit-details-marker { display: none; }
.assistant-reasoning > summary:hover,
.assistant-reasoning > summary:focus-visible { opacity: 1; }
.assistant-reasoning > summary svg { width: 0.875rem; height: 0.875rem; }
.assistant-reasoning-body {
  margin-top: 0.375rem;
  padding-left: 0.75rem;
  border-left: 2px solid var(--border);
  max-height: 16rem;
  overflow-y: auto;
}
```

Use os tokens de cor já usados no arquivo se `--muted-foreground`/`--border` tiverem outro nome.

- [ ] **Step 6: Rodar testes, tipos e lint**

Run: `cd frontend && npx vitest run src/features/managed-agent-chat-parts.test.tsx src/features/managed-agent-chat.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(chat): show collapsible reasoning summaries"
```

---

### Task 4: Documentação e verificação local

**Files:**
- Modify: `CHANGELOG.md` (Unreleased)
- Modify: `README.md` (seção do chat gerenciado)

- [ ] **Step 1: Changelog**

Em `## Unreleased`:

```markdown
- Show Codex reasoning summaries in team chats while the agent works; they collapse when the reply finishes and stay available in history. Raw model reasoning is never stored or displayed.
```

- [ ] **Step 2: README**

Na seção do chat gerenciado/team chat, acrescente:

```markdown
While a request runs, the chat shows the Codex reasoning *summary* in a muted "Reasoning" section that collapses automatically when the reply finishes and can be reopened later. Summaries are limited to 16 KiB per message; raw reasoning is never persisted. Summaries appear only when the selected model and Codex configuration produce them (`model_reasoning_summary`).
```

- [ ] **Step 3: Verificação completa**

Run: `cargo build && BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test && (cd frontend && npm test -- --run)`
Expected: tudo PASS.

- [ ] **Step 4: Verificação manual no app local**

Reinicie o backend preservando `BEE_SESSION_INSTALLATION_ID`, `BEE_CODEX_EXECUTABLE` e `OTEL_ENABLED=false`. Abra um novo chat em `http://127.0.0.1:5175`, peça algo que exija raciocínio (ex.: “planeje como organizar as tarefas do board”) e confirme: área “Pensando…” aberta durante a execução → “Raciocínio” recolhido ao concluir → reabre ao clicar → continua após recarregar a página. Se o modelo não emitir resumos, a área não aparece.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: describe chat reasoning summaries"
```

---

## Self-review

- Cobertura: captura só de resumos (T1), persistência limitada + paridade de contrato (T2), aberto ao executar / recolhido ao terminar / disponível no histórico / discreto (T3), docs (T4).
- Nomes consistentes: `IntegratedEvent::Reasoning`, `ReasoningSummary`, `save_reasoning`, `bounded_reasoning`, campo `reasoning`, `MessageReasoning`, prop `active`, chaves `managed.reasoning`/`managed.reasoningActive`.
- Fora de escopo: atividades de ferramentas (`IntegratedEvent::Tool`) e leader chat legado.
