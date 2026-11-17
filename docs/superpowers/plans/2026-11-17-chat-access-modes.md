# Modos de acesso do chat — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** substituir as opções soltas de acesso e rede do chat do líder por quatro modos. O usuário escolhe o modo em um botão com popover logo abaixo da caixa de texto, e o padrão fica definido nas Configurações globais.

**Arquitetura:** o modo é um valor fechado (`AccessMode`) enviado em cada `SendMessage` e gravado no registro do turno (`leader_chat_turns.data.accessMode`), sem migração. O provider Codex converte o modo em `approvalPolicy` + `sandboxPolicy` no `turn/start`. No modo `codex_config`, os valores efetivos vêm do `config.toml` local, lidos por `config/read`. O padrão é uma preferência do dispositivo (zustand persist), igual à posição do chat. O backend continua validando e decidindo; a UI só escolhe.

**Stack:** Rust (axum, serde, Codex App Server via JSON-RPC), React + TypeScript, zustand, Vitest, i18n pt/en.

## Os quatro modos

| ID (`accessMode`) | Rótulo pt / en | `sandboxPolicy` | `approvalPolicy` | Rede nos comandos |
|---|---|---|---|---|
| `read_only` | Somente leitura / Read only | `{"type":"readOnly"}` | `on-request` | não |
| `standard` (padrão) | Padrão / Standard | `{"type":"workspaceWrite","writableRoots":[],"networkAccess":<rede>}` | `on-request` | sim (*) |
| `full_access` | Acesso total / Full access | `{"type":"dangerFullAccess"}` | `never` | sim |
| `codex_config` | Configuração do Codex (config.toml) / Codex configuration (config.toml) | valor efetivo de `config/read` | valor efetivo de `config/read` | conforme o arquivo |

(*) `standard` reproduz o comportamento atual: `workspace-write` + `on-request` + rede ligada. Se a sessão foi criada com `toolProfile.networkAccess = false`, a opção mais restritiva prevalece e a rede fica desligada. Nunca ampliar permissões silenciosamente.

## Restrições globais

- `full_access` exige uma confirmação explícita na UI, com aviso, toda vez que for escolhido no popover ou definido como padrão.
- O backend rejeita modos desconhecidos com `400 invalid_request`; um valor ausente vira `standard` (compatibilidade com clientes antigos e com a MCP).
- Mensagens de leitura e escrita continuam sob a fronteira de execução local já existente (loopback/origem); o modo não é autenticação.
- Turnos `uncertain` e retries preservam o `accessMode` original junto com `clientMessageId`, sem reenviar o turno com outro modo.
- `codex_config` nunca lê nem expõe segredos: usa somente `sandbox_mode`, `approval_policy` e `sandbox_workspace_write.network_access` do resultado de `config/read`.
- Entregas automáticas aos workers (`worker_delivery.rs`) continuam usando `standard`; o chat de workers gerenciados está fora deste escopo (follow-up).
- Nenhum arquivo de código-fonte pode passar de 1000 linhas; respeitar routes → dto → service → repository.
- Atualizar `CHANGELOG.md` (Unreleased, em inglês) e o README/guia do chat.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/dto/access_mode.rs` (novo) | enum `AccessMode`, serde e default |
| `src/dto/leader_chat.rs` | campo `access_mode` em `SendMessage` |
| `src/services/leader_chat/rules.rs` | grava `accessMode` no turno |
| `src/services/leader_chat/execution.rs` | lê o modo do turno e repassa ao provider |
| `src/repositories/codex_access.rs` (novo) | `turn_overrides(mode, network, effective)` — função pura |
| `src/repositories/integrated_provider.rs` | `run(..., access: AccessMode, ...)` |
| `src/repositories/codex_integrated.rs` | aplica os overrides no `turn/start`; `config/read` para `codex_config` |
| `docs/proposals/integrated-chat-openapi.json` | `SendMessage.accessMode` + `Turn.accessMode` |
| `frontend/src/state/chat-access.ts` (novo) | padrão persistido + escolha por chat |
| `frontend/src/features/chat-access-picker.tsx` + `.css` (novos) | botão + popover abaixo do composer |
| `frontend/src/features/chat-access-settings.tsx` (novo) | seletor do padrão nas Configurações globais |
| `frontend/src/features/leader-chat.tsx`, `use-leader-chat.ts` | envia o modo; remove o checkbox de rede da criação da sessão |
| `frontend/src/i18n/catalogs/chat.{pt,en}.json`, `settings.{pt,en}.json` | textos |

---

### Tarefa 1: contrato `AccessMode` no backend

**Arquivos:** criar `src/dto/access_mode.rs`; alterar `src/dto/mod.rs`, `src/dto/leader_chat.rs`, `src/services/leader_chat/rules.rs`; teste em `src/dto/access_mode.rs` (`#[cfg(test)]`) e no teste HTTP existente do chat do líder.

**Produz:** `crate::dto::access_mode::AccessMode` (`ReadOnly | Standard | FullAccess | CodexConfig`, `serde(rename_all = "snake_case")`, `Default = Standard`, `AccessMode::as_str()`); `SendMessage.access_mode: AccessMode` com `#[serde(default)]`; turno grava `"accessMode": mode.as_str()`.

- [ ] **Passo 1 — teste que falha**

```rust
#[cfg(test)]
mod tests {
    use super::AccessMode;
    #[test]
    fn parses_known_modes_and_defaults_to_standard() {
        assert_eq!(serde_json::from_str::<AccessMode>("\"full_access\"").unwrap(), AccessMode::FullAccess);
        assert_eq!(AccessMode::default(), AccessMode::Standard);
        assert!(serde_json::from_str::<AccessMode>("\"root\"").is_err());
    }
}
```

No teste HTTP de envio do chat do líder, enviar `"accessMode":"read_only"` e conferir `turn.accessMode == "read_only"` na leitura; outro caso sem o campo espera `"standard"`; `"accessMode":"root"` espera `400`.

- [ ] **Passo 2 — rodar e ver falhar:** `OTEL_ENABLED=false BEE_TEST_DRIVER=sqlite cargo test access_mode leader_chat`
- [ ] **Passo 3 — implementar**

```rust
//! Closed set of chat execution access modes.
use serde::{Deserialize, Serialize};
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessMode { ReadOnly, #[default] Standard, FullAccess, CodexConfig }
impl AccessMode {
    pub fn as_str(self) -> &'static str {
        match self { Self::ReadOnly => "read_only", Self::Standard => "standard",
                     Self::FullAccess => "full_access", Self::CodexConfig => "codex_config" }
    }
}
```

Em `SendMessage`: `#[serde(default)] pub access_mode: AccessMode,`. Em `rules::send`, incluir `"accessMode": req.access_mode.as_str()` no `data` do turno criado. A chave de idempotência continua cobrindo o corpo inteiro; logo, reenviar a mesma chave com outro modo gera o conflito de replay que já existe.

- [ ] **Passo 4 — rodar e ver passar** (mesmo comando, mais `cargo build`).
- [ ] **Passo 5 — commit:** `feat(chat): accept an access mode per leader chat message`

### Tarefa 2: aplicar o modo no Codex

**Arquivos:** criar `src/repositories/codex_access.rs`; alterar `src/repositories/mod.rs`, `integrated_provider.rs`, `codex_integrated.rs`, `src/services/leader_chat/execution.rs`, `worker_delivery.rs` e os fakes de provider nos testes.

**Consome:** `AccessMode`. **Produz:** `pub fn turn_overrides(mode: AccessMode, network: bool, effective: Option<&Value>) -> Value`, que retorna `{"approvalPolicy":…,"sandboxPolicy":…}`; e `IntegratedProvider::run(target, text, profile, access: AccessMode, events, controls)`.

- [ ] **Passo 1 — confirmar o protocolo local** (sem palpite): `codex app-server generate-json-schema --out /tmp/codex-schema`. Conferir em `TurnStartParams` os nomes `approvalPolicy`/`sandboxPolicy`, as variantes `readOnly`/`workspaceWrite`/`dangerFullAccess` e os valores `on-request`/`never`, além da resposta de `config/read`. Se diferirem, ajustar a tabela deste plano antes de seguir.
- [ ] **Passo 2 — testes que falham** (unitários de `codex_access.rs`)

```rust
#[test]
fn standard_keeps_current_behaviour_and_restrictive_network_wins() {
    let v = turn_overrides(AccessMode::Standard, false, None);
    assert_eq!(v["approvalPolicy"], "on-request");
    assert_eq!(v["sandboxPolicy"]["type"], "workspaceWrite");
    assert_eq!(v["sandboxPolicy"]["networkAccess"], false);
}
#[test]
fn full_access_never_asks() {
    let v = turn_overrides(AccessMode::FullAccess, true, None);
    assert_eq!(v, serde_json::json!({"approvalPolicy":"never","sandboxPolicy":{"type":"dangerFullAccess"}}));
}
#[test]
fn codex_config_uses_effective_values_and_falls_back_to_read_only() {
    let eff = serde_json::json!({"config":{"sandbox_mode":"workspace-write","approval_policy":"on-failure",
        "sandbox_workspace_write":{"network_access":true}}});
    let v = turn_overrides(AccessMode::CodexConfig, false, Some(&eff));
    assert_eq!(v["approvalPolicy"], "on-failure");
    assert_eq!(v["sandboxPolicy"]["networkAccess"], true);
    assert_eq!(turn_overrides(AccessMode::CodexConfig, true, None)["sandboxPolicy"]["type"], "readOnly");
}
```

- [ ] **Passo 3 — implementar** `turn_overrides` (match exaustivo da tabela; `codex_config` traduz `read-only|workspace-write|danger-full-access` e cai em `readOnly` + `on-request` quando faltar ou for inválido). Em `codex_integrated.rs::execute`, quando o modo for `CodexConfig`, fazer `w.request("config/read", json!({"includeLayers":false}))` antes do `turn/start`. Mesclar o resultado de `turn_overrides` em `params` (`threadId`, `disabledPluginIds`, `input`). Em `session()`, não enviar `sandbox_workspace_write.network_access` quando o modo for `CodexConfig`. `execution.rs` lê `turn.data["accessMode"]` (ausente → `Standard`); `worker_delivery.rs` passa `AccessMode::Standard`.
- [ ] **Passo 4 — teste de integração com provider fake:** o fake registra o `access` recebido; enviar uma mensagem `read_only` e conferir que o provider recebeu `ReadOnly`.
- [ ] **Passo 5 —** `cargo build && OTEL_ENABLED=false BEE_TEST_DRIVER=sqlite cargo test` → tudo verde, exceto os testes exclusivos de PostgreSQL quando `BEE_TEST_DATABASE_URL` não estiver configurado.
- [ ] **Passo 6 — commit:** `feat(chat): map access modes to Codex turn sandbox and approvals`

### Tarefa 3: contrato público e tipos gerados

**Arquivos:** `docs/proposals/integrated-chat-openapi.json`, `frontend/src/api/generated/chat/*` (gerados), `docs/mcp-catalog.json` (se a ferramenta MCP de chat mudar).

- [ ] Adicionar o schema `AccessMode` (`enum: [read_only, standard, full_access, codex_config]`, `default: standard`). Em `SendMessage`, incluir `accessMode` opcional; em `Turn`, `accessMode` obrigatório na resposta.
- [ ] `cd frontend && npm run generate:types` e revisar o diff gerado.
- [ ] Procurar ferramentas MCP que enviem mensagens ao chat do líder (`grep -rn "leader_chat" src/routes/mcp*.rs src/dto/*tools*.rs`). Se existirem, aceitar o mesmo `accessMode` pela mesma DTO e regenerar com `cargo run --locked --features mcp --example mcp_catalog`.
- [ ] `npx tsc -b`; commit: `docs(chat): publish accessMode in the integrated chat contract`

### Tarefa 4: estado do modo no frontend

**Arquivos:** criar `frontend/src/state/chat-access.ts` e `chat-access.test.ts`.

**Produz:** `type AccessMode = components["schemas"]["AccessMode"]`; `ACCESS_MODES: readonly AccessMode[]` na ordem da tabela; o hook `useChatAccess`, com `{ defaultMode, byChat: Record<string, AccessMode>, setDefault(mode), choose(chatId, mode) }`, persistido em `localStorage` (`bee-chat-access`); e `modeForChat(chatId?: string): AccessMode`, que retorna a escolha do chat ou `defaultMode`.

- [ ] **Teste que falha:** sem escolha, `modeForChat("c1")` retorna o padrão; depois de `choose("c1","read_only")`, retorna `read_only`, enquanto `"c2"` continua seguindo o padrão; mudar o padrão não altera chats com escolha explícita.
- [ ] Implementar com `zustand` + `persist` (padrão `standard`; descartar valores desconhecidos ao reidratar).
- [ ] `npx vitest run src/state/chat-access.test.ts`; commit.

### Tarefa 5: botão com popover abaixo da caixa de texto

**Arquivos:** criar `frontend/src/features/chat-access-picker.tsx`, `chat-access-picker.css` e `chat-access-picker.test.tsx`; alterar `leader-chat.tsx`, `use-leader-chat.ts` e `chat.{pt,en}.json`.

**Consome:** `useChatAccess`, `modeForChat`, `ACCESS_MODES`.

Comportamento:
- Um botão compacto fica na linha de ações do composer (`.leader-chat-actions`), à esquerda do Enviar. Ele mostra um ícone e o rótulo do modo atual (`ShieldCheck`, `Shield`, `ShieldAlert` ou `FileCog`) e tem `aria-haspopup="dialog"`.
- O popover usa o componente Popover já disponível no projeto. Ele lista os 4 modos em um `radiogroup`, cada um com uma descrição de uma linha, além do link “Definir padrão”, que abre as Configurações globais.
- Escolher `full_access` abre uma confirmação (“Os comandos poderão alterar qualquer arquivo e acessar a rede sem pedir aprovação.”). Só depois da confirmação o modo é aplicado.
- A escolha vale para o chat atual (`choose(chat.chatId, mode)`); quando ainda não há chat, vale como escolha pendente e passa para o chat criado.
- O seletor fica desabilitado durante `chat.working` ou `sendUncertain`. O retry incerto reutiliza o modo do envio original, guardado no mesmo `pending` em `use-leader-chat.ts`.
- `send()` passa `accessMode: modeForChat(chat.chatId)` no corpo de `SendMessage`.
- Remover o checkbox “Acesso à rede” do formulário de criação da sessão (`leader-chat.tsx`, por volta das linhas 245–255), porque a rede passa a fazer parte do modo. O `toolProfile.networkAccess` continua sendo enviado como `true` para manter o contrato existente.

- [ ] **Testes que falham** (`chat-access-picker.test.tsx` + caso em `leader-chat.test.tsx`): o botão mostra “Padrão”; ao abrir, aparecem 4 opções com `aria-checked`; escolher “Somente leitura” atualiza o botão; “Acesso total” exige confirmação, e cancelar mantém o modo anterior; enviar mensagem inclui `accessMode: "read_only"` no corpo; o retry incerto reenvia o mesmo modo e a mesma chave.
- [ ] Implementar, adicionar i18n (`chat.access.*`) e as exceções de i18n necessárias em `scripts/i18n-exceptions.json`.
- [ ] `npx vitest run src/features/chat-access-picker.test.tsx src/features/leader-chat.test.tsx src/i18n`; `npx oxlint src`; commit.

### Tarefa 6: padrão nas Configurações globais

**Arquivos:** criar `frontend/src/features/chat-access-settings.tsx` e o teste correspondente; alterar o diálogo de Configurações globais (`components/navigation-rail.tsx` ou `components/appearance-settings.tsx`, onde já fica “Posição do chat”) e `settings.{pt,en}.json`.

- [ ] **Teste que falha:** a seção “Chat” mostra o seletor “Acesso padrão dos chats” com os 4 modos; escolher “Acesso total” pede confirmação; após confirmar, `useChatAccess.getState().defaultMode === "full_access"`; o texto de ajuda informa que a preferência vale para chats sem escolha própria neste dispositivo.
- [ ] Implementar com o mesmo `ToggleGroup`/`select` usado em “Posição do chat”, reaproveitando os rótulos e o diálogo de confirmação da Tarefa 5 (exportados de `state/chat-access.ts` e de um componente `FullAccessConfirm`).
- [ ] Rodar os testes; commit.

### Tarefa 7: documentação e verificação final

- [ ] `CHANGELOG.md` → Unreleased: “Choose the chat access mode (Read only, Standard, Full access, or Codex configuration from config.toml) from a button below the message box, and set the default in global settings.”
- [ ] README/guia do chat: explicar os modos e a regra de rede mais restritiva para sessões antigas.
- [ ] `cd frontend && npx tsc -b && npx oxlint src && npx vitest run`; `cargo build`; `OTEL_ENABLED=false BEE_TEST_DRIVER=sqlite cargo test`.
- [ ] Verificação manual com o Codex real em uma instância isolada (porta alternativa): em `read_only`, pedir para criar um arquivo deve resultar em pedido de aprovação ou bloqueio; em `standard`, o arquivo é criado na pasta do agente; em `full_access`, nenhuma aprovação é pedida; em `codex_config`, o comportamento segue o `~/.codex/config.toml` sem expor o conteúdo.
- [ ] Commit: `docs(chat): document chat access modes`

## Fora de escopo (follow-up)

- Padrão salvo no servidor (por instalação) em vez de por dispositivo. Isso exige migração SQLite/PostgreSQL e inclusão no transfer.
- Modos de acesso no chat de workers gerenciados (`managed-agent-chat.tsx` / `codex_session.rs`).
- Escolher um `[profiles.<nome>]` específico do `config.toml`.
