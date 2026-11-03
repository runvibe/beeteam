# Fontes de tokens por harness — verificação oficial em 2026-11-02

Este levantamento atualiza o plano `superpowers/plans/2026-10-30-token-model-ledger.md`.
É pesquisa de capacidades, não prova de um coletor instalado ou acesso à sessão atual.
Nenhum prompt, credencial ou log privado foi coletado; não foram iniciadas sessões.
A exigência nova de total numérico/agente substitui o fallback anterior que permitia
salvar novos resumos apenas com unavailable. Sem fonte válida, a gravação deve falhar.

| Harness / superfície | Fonte efetivamente documentada | Limite operacional |
|---|---|---|
| Codex App Server controlado | `thread/tokenUsage/updated`, IDs de thread/turno; gerar schema na versão instalada | Conexão/stream da execução são necessários; não observa automaticamente outro chat desktop |
| Codex exec | `codex exec --json`, evento `turn.completed.usage` com input_tokens/cached_input_tokens/output_tokens/reasoning_output_tokens | Somente a execução capturada; não iniciar nova execução para medir conversa existente |
| Copilot SDK | evento efêmero `assistant.usage`, modelo e contadores opcionais, apiCallId/serviceRequestId | Assinar e persistir antes das chamadas; campos ausentes não equivalem a zero; normalização cache depende do endpoint |
| Copilot CLI | `/usage` documenta métricas da sessão e totais por modelo; spans OTel chat/invoke_agent documentam input/output | /usage pode mostrar apenas créditos para modelos sem contadores. Exportação precisa estar configurada; não somar chat e invoke_agent sobre as mesmas chamadas |
| Copilot Chat VS Code | OTel documentado, spans `chat` por chamada com input/output e `invoke_agent` agregado | Habilitação explícita; `session.id` é janela VS Code, não confundir com conversation ID. Conteúdo desativado por padrão |
| Claude Code SDK | usage de mensagem/resultado e modelUsage/model_usage por modelo | Resultado pode incluir sessão retomada; modelUsage inclui subagentes, usage apenas loop principal; escolher fonte canônica e baseline |
| Claude Code OTel | `claude_code.token.usage` por modelo/tipo | Exige exportação configurada e identidade/período; não habilitar captura de prompts/respostas para obter contadores |
| Claude Code statusline | context_window/current_usage | Ocupação/resposta recente, não consumo cumulativo; não subtrair como ledger |
| Cursor Admin API | POST `/teams/filtered-usage-events`, tokenUsage e conversationId opcionais | Acesso administrativo autorizado; dados agregados por hora e paginação. Sem contadores ou vínculo, não usar como total exato da task |
| Kiro CLI/IDE/ACP | `/usage` documenta billing/créditos; `/context` é ocupação; ACP documenta sessão/modelo/stream | Não foi localizado nas páginas consultadas contrato estável de tokens brutos por chamada; ausência na pesquisa não prova impossibilidade. Créditos/contexto não satisfazem medição |

## Pontos de coleta que exigem configuração explícita

- Copilot CLI: `COPILOT_OTEL_ENABLED=true`, endpoint OTLP ou
  `COPILOT_OTEL_FILE_EXPORTER_PATH` habilitam exportação (desabilitada por padrão).
  O último define explicitamente o arquivo JSONL de sinais; não há caminho presumido.
  A referência descreve spans
  `chat` com `gen_ai.conversation.id`, `gen_ai.response.id`, `gen_ai.usage.input_tokens`
  e `gen_ai.usage.output_tokens`. `invoke_agent` agrega todos os turnos. Escolher
  um nível; conteúdo de mensagens é opt-in e não é necessário para contadores.
- Copilot Chat VS Code: `github.copilot.chat.otel.enabled` ou
  `COPILOT_OTEL_ENABLED=true`/endpoint OTLP habilitam telemetria. A documentação
  distingue Local harness e Agent Host; não extrapolar para JetBrains/cloud.
  `github.copilot.chat.otel.dbSpanExporter.enabled` também ativa exportação local,
  mas nenhum caminho/arquivo de banco privado foi inspecionado ou presumido.
- Claude Code: `CLAUDE_CODE_ENABLE_TELEMETRY=1` e `OTEL_METRICS_EXPORTER=otlp`
  exportam métricas ao endpoint configurado. A alternativa Prometheus documentada
  expõe `http://localhost:9464/metrics` quando habilitada e compatível com o runner.
  Isso não prova que a porta ou exporter existe nesta máquina; nenhuma configuração
  foi alterada. Cloud precisa configuração no próprio ambiente remoto.
- Cursor: endpoint completo `https://api.cursor.com/teams/filtered-usage-events`;
  paginação e janela explícitas, somente com credencial administrativa autorizada.
- Codex: o stream JSONL é stdout do processo `codex exec --json` controlado;
  App Server exige sua conexão de protocolo. Não há arquivo de tokens universal
  documentado nas páginas consultadas que uma Skill possa presumir legível.

- Kiro Enterprise exporta CSV diário por cliente em
  `s3://bucketName/prefix/AWSLogs/accountId/KiroLogs/user_report/region/year/month/day/00/clientType_accountId_user_report_timestamp.csv`
  ou agregados equivalentes por OTel. Os campos publicados incluem créditos,
  mensagens e conversas; não incluem contador de tokens. Isso não resolve o total
  exigido por resumo. Exige configuração administrativa; nenhum bucket foi acessado.

## Normalização e escopo

Input/output no Bee Team são inclusivos. Cache e raciocínio já incluídos não são
somados novamente. APIs que reportem input sem cache precisam de normalização
comprovada para a versão/endpoint antes da ingestão; nomes semelhantes não provam
semântica igual. A documentação do Copilot explicita raciocínio como subconjunto
de output, mas não resolve sozinha todas as variantes de input/cache. Cursor expõe
categorias separadas; não inferir total apenas de inputTokens se o input inclusivo
não foi estabelecido. Claude retorna mensagens repetidas com o mesmo ID/uso: contar
uma vez; retomadas e agregados de árvore exigem baseline e escopo declarado.
A documentação OTel de Claude confirma que input exclui cache: normalize input +
cacheRead + cacheCreation uma única vez no adapter, persistindo esse input inclusivo.
Depois disso o backend soma apenas input inclusivo + output, nunca cache novamente.

Um total de sessão/árvore não vira consumo exclusivo da tarefa. Período observado,
ator responsável, fonte, sessão/epoch e evidências devem acompanhar qualquer total.
Baseline isolado, janela de contexto, limite de conta, créditos, custo monetário,
percentual de progresso e tamanho do texto não demonstram consumo de um intervalo.
Zero só representa medição explícita de zero; erro/ausência de contagem não é zero.

## Fontes oficiais consultadas

- [Codex App Server](https://learn.chatgpt.com/docs/app-server#turn-events): evento de uso da thread e correlação do stream.
- [Codex não interativo](https://learn.chatgpt.com/docs/non-interactive-mode): JSONL e exemplo de turn.completed.usage.
- [Copilot SDK events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events): assistant.usage efêmero e campos opcionais.
- [Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference): /usage com totais por modelo.
- [Copilot Chat VS Code OTel](https://code.visualstudio.com/docs/agents/guides/monitoring-agents): configuração, spans e contadores por chamada/sessão.
- [Kiro atividade por usuário](https://kiro.dev/docs/enterprise/monitor-and-track/user-activity/): formatos, caminho S3 e campos diários publicados.
- [Claude SDK cost/usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking): repetição de mensagens, retomadas e escopo de subagentes.
- [Claude statusline](https://code.claude.com/docs/en/statusline): current_usage e contadores de contexto/resposta recente.
- [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage): exportação OTel e token.usage.
- [Cursor Admin API](https://cursor.com/docs/account/teams/admin-api): endpoint de eventos, tokenUsage/conversationId opcionais, granularidade horária.
- [Kiro slash commands](https://kiro.dev/docs/reference/slash-commands/): billing/créditos e contexto.
- [Kiro ACP](https://kiro.dev/docs/cli/acp/): negociação, sessões e mensagens; sem contrato de contador confirmado aqui.

Logs locais de Codex/Copilot/Claude citados no plano anterior são formatos internos,
fora da garantia das APIs acima. Caminho convencional não prova identidade da sessão,
cobertura ou estabilidade. Só usar adapter opt-in versionado com fixture validada;
não varrer pastas de conversas nem ler credenciais como fallback. CLI, desktop, IDE,
cloud e SDK precisam de evidências independentes. Sem acesso permitido à fonte da
sessão correta, registrar impedimento por comentário, sem fabricar resumo/métricas.
