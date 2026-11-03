# Frente de skills Bee Team

Escopo: skills, referências, exemplos e README. Sem alterações de backend/frontend/contratos, instalação global, push ou merge.

## Checklist da retomada

- [x] Revisar os seis documentos atuais no checkout fonte, sem alterá-los.
- [x] Adaptar domínio: sem workspace; board com criador/time gestor; tasks sem time, autor/executor; recursão cross-board ilimitada; transferência preserva histórico.
- [x] Adaptar autonomia: contexto da raiz; origem manual/standard/automatic, flag individual em standard, sem sobrescrever destino.
- [x] Atualizar rotas, briefing, encerramento e README; preservar exemplos multidisciplinares.
- [x] Validar comportamento final de líder e colaborador em simulações sem efeitos externos.
- [x] Validar estrutura, links e bindings; executar cargo build/test (12 unitários passaram; integração bloqueada por Docker).
- [x] Registrar evidências; entrega em commit local focado em skills e README, sem push/merge.

## Diferenças e limites

A revisão substitui os drafts anteriores de autonomia board/task com herança automática do pai. Também remove task-time e limites indefinidos de profundidade. Os documentos fonte foram lidos em `C:/Users/phili/Documents/ChatGPT/coordenator` em 27/10/2026; contratos continuam `0.1.0-draft`. Os seis documentos foram sincronizados da fonte por orientação explícita, sem editar a fonte; serão excluídos do commit das skills. A integração do branch de destino deve incluir os documentos atuais. Nenhuma validação aqui comprova API/MCP em execução ou integração entre worktrees.

Pendente de produto: alcance de edição do líder sobre tasks de executores geridos. Skills orientam leitura/planejamento e encaminhamento de uma pergunta quando uma edição depender disso, sem presumir permissão.

Baseline anterior sem skill: perguntou escolha de modo em vez de aplicar aprovação padrão; encerramento não explicitou todos os dados de continuidade. Versão anterior passou validação estrutural e seis cenários do líder; isso não valida as regras finais alteradas. Build anterior passou; test foi interrompido durante a pausa solicitada.

Evidências detalhadas e hashes: [validation.md](validation.md).

## Incremento de conteúdo MCP

- [x] Conferir protocolo e SDK efetivo: rmcp 2.0.0, handlers resources/prompts presentes; sem upgrade.
- [x] Criar três templates parametrizados e manifesto editorial, sem nomes de tools/URIs inventados.
- [x] Documentar allowlist, descoberta, efeito somente leitura e integração com compostas.
- [x] Validar renderização e quatro cenários simulados; build passou, 12 unitários passaram, três integrações bloqueadas por Docker.
- [x] Entregar caminhos ao coordenador; incremento em commit local separado, sem push/merge.

## Alinhamento final ao MCP implementado

- [x] Ler catálogo Markdown/JSON e OpenAPIs do backend 8fbc, revisão e39c79b.
- [x] Alinhar líder/colaborador, referências e prompts às tools, resources e prompts implementados.
- [x] Validar quatro exemplos contra schemas reais; validar nomes/argumentos de prompts, URIs, links e duas skills.
- [x] Executar build/test: build e 12 unitários passaram; três integrações bloqueadas por Docker.
- [x] Concluir cinco cenários simulados sem falhas materiais; entrega em commit local e lista de snapshots ao coordenador.

Sem edição no worktree backend. Os snapshots resources/bee-team permanecem responsabilidade daquela frente; este commit editorial não os atualiza automaticamente.

## Síntese atual cumulativa

- [x] Adaptar instruções e prompts ao requisito currentSummary confirmado.
- [x] Conferir DTO/OpenAPI/catálogo estáveis: quatro exemplos e negativos de síntese ausente/vazia/whitespace passaram.
- [x] Validar cinco cenários e estrutura; build/12 unitários passaram, três integrações Docker indisponível; entrega em commit local com lista de snapshots.

Validação final feita no catálogo regenerado: 57 tools, seis resources e três prompts preservados. Snapshots anteriores sem currentSummary precisam ser atualizados pelo backend.

## Especificação própria e Markdown

- [x] Preparar líder/colaborador, referências e três prompts com distinção description/specification/plan.content/currentSummary.
- [x] Conferir OpenAPI/catálogo estáveis; seis exemplos válidos, negativos de null/progress sem síntese e limites UTF-8 conferidos.
- [x] Validar cenários, estrutura e links; build/12 unitários passaram, três integrações bloqueadas por Docker; entrega em commit local com lista de snapshots.

Exemplos updateTask/specification e createPlan/content publicados e validados contra catálogo estável. Nenhum runtime ou snapshot de outro worktree foi alterado.

## Slugs de navegação

- [x] Preparar distinção slug/UUID e resolução por tipo nas skills, referências e prompts.
- [x] Conferir fontes estáveis: nove exemplos passaram; negativos de slug/envelope, UUIDs e argumentos de prompts conferidos.
- [x] Validar cenários de slug; corrigir parâmetros descritos de briefing/revisão; build/12 unitários passaram, integração Docker bloqueada; entrega em commit local e lista de snapshots.

Catálogo estável com 60 tools, seis resources e três prompts conferido; backend não foi alterado nesta frente.

## Aplicação local e readiness

- [x] Revisar skills: antes havia descoberta de API, mas não fluxo explícito de startup/reuso.
- [x] Conferir scripts backend e procedimento frontend com responsável backend.
- [x] Verificar ambiente vivo em leitura: banco18, API, MCP, proxy e painel recarregado; sem iniciar/duplicar processos.
- [x] Orientar líder/startup e colaborador/reuso, dados preservados, bloqueio sem contorno, URL real.
- [x] Avaliar seis cenários simulados; validar estrutura e links; build e 12 unitários passaram, três integrações falharam ao criar containers neste checkout.

Nenhum teste de parada executado no ambiente compartilhado; cenários simulados e verificações reais estão separados em validation.md. Sem SQLite, migração, bootstrap/seed, reset ou restart. Entrega em commit local; sincronização dos snapshots e validação do novo runtime cabem ao backend.

## Onboarding MCP no chat

- [x] Corrigir lacuna entre endpoint ativo e conexão cadastrada/exposta.
- [x] Incluir comandos Codex oficiais, endereços locais por finalidade, autorização/escopo e atualização de sessão.
- [x] Validar skills, links e build; 12 unitários passaram, três integrações falharam ao criar containers. Sem alteração de configuração pessoal, instalação ou restart.

## Escolha e formação do time

- [x] Primeira interação escolhe time salvo contexto explícito; identidade/perfil do líder existente preservados.
- [x] Nova equipe exige descoberta e aprovação concreta mesmo com autonomia; exemplos de alterações e inconsistências incluídos.
- [x] Revisão textual de cenários, links e quick_validate UTF-8 passaram; build e 12 unitários passaram, três integrações CreateContainer/NotFound falharam.

## Aplicação dos workflows aprovados

- [x] Entradas enxutas com invariantes, referências próprias e workflows completos derivados de docs01e77b9.
- [x] Alinhar handoff/integração/Codex/exemplos/prompts e remover exigência antiga de persistência adicional de chat no RA.
- [x] Revisão comportamental independente e validação estrutura/links/templates; build e 12 unitários passaram, três integrações falharam ao criar containers.
- [ ] Backend sincronizar conteúdo completo e verificar runtime; instalação pessoal é operação separada com proveniência e backup.

## Planejamento registrado da Leader

- [x] Reusar/criar task própria antes de planejamento substantivo; bootstrap sem cadastros materializa contexto assim que possível.
- [x] Persistência incremental/status reais, distinção Collaborator e catálogo MCP dinâmico aplicados a docs/skills/pacotes.
- [x] Revisão independente corrigiu caminho novo time para passar pelo board; links/estrutura/build e 12 unitários passaram, três integrações CreateContainer/NotFound falharam.

- Condução visual natural exclusiva do Leader aplicada em entradas, workflows/Mermaid e referência Codex; alinhamento fast-forward com main fd78b37. Sem alterações de runtime/configuração; snapshot MCP fica para sincronização Backend.

- 2026-10-29: tarefas/comentários passam a ser fonte de verdade de toda comunicação de trabalho entre agentes; chats só notificam referências/tipo após persistência confirmada. Workflows, exemplos e prompts coerentes; preservadas autorizações, atribuição e condução visual exclusiva Leader.

- 2026-10-30: padrão 👑 no título do chat atual da Leader confirmada, idempotente e preservando contexto; normalização na busca sem inferir identidade. Só pacote Leader instalado nesta entrega, sem renomear chats ou modificar runtime.

- 2026-10-30: generalizado título de papel 👑 Leader / 🐝 Collaborator desde ativação antes da identidade; troca substitui marca sem acumular, criação autorizada já marca Collaborator e busca normaliza prefixos. Ambos pacotes instaláveis, nenhum rename real nesta tarefa.

- 2026-10-30: interação via comentário completo obrigatório (inclusive sóstatus), aviso task/áreas/status pertinente/commentID e leitura MCP exata; dúvidas/relatos/pedidos Collaborator via Leader e decisões humanas Leader via comentário/referência sem caixas interativas. Contrato getComment/createdComments confirmado Backend incorporado; somente ativação inicial de novo chat Collaborator dispensa comentário.

- 2026-10-31: métricas opcionais por resumo nas duas skills, workflows, prompts e integração. Estratégia/proveniência investigadas no início e reusadas; tentativa fresca por resumo, ausência não bloqueia nem exige unavailable. Contrato Backend documentado com contadores inclusivos/subconjuntos, baseline/época/evidência, replay e reconciliação tardia. Publicação do bundle/proveniência MCP continua sob responsabilidade Backend.

- 2026-10-31: instrução posterior do usuário revogou a opcionalidade acima. Novos resumos exigem usageReport com medição ou unavailable factual; legado/replay preservado. Fontes alinhadas ao contrato final Backend; instalação global autorizada com backup/paridade, seguida de sincronização do bundle pela frente Backend.

- 2026-11-02: novo Collaborator começa pelo chat autorizado, configura/reutiliza o próprio cadastro/vínculo e retorna nome real, agentId/teamId e readiness. Leader verifica antes de atribuir. Exceção inicial cobre bootstrap/retorno e complemento cadastral limitado; trabalho posterior mantém task/commentID. Instalação pessoal com backup/paridade separada do bundle Backend.

- 2026-11-02: status posterior à criação somente via registro de resumo atômico com statusObserved/usageReport; close_activity usa o mesmo serviço. moveTask só reordena mesmo status; PATCH/record_progress não aceitam statusId. Percentual independente, comentários, legado e idempotência preservados.

- 2026-11-02: usuário autorizou instalar imediatamente com usageReport atual, sem esperar novo shape Backend. Skills exigem tokens reais/modelo observado/harness/agente/fonte, sem unavailable substitutivo; indisponibilidade vira comentário/impedimento. Baseline real é preservado, sem rejeição por ser inicial ou inferência de consumo exato da task. Decisão acumulado de sessão versus exclusivo da task permanece pendente; nenhum campo tokenUsage/total novo introduzido.

- 2026-11-02: decisão final exige acumulado real da sessão até cada resumo. SessionUsageInput/SessionUsageObservation exigem totalTokens=input+output em strings int64, cumulative_snapshot, session/session_tree, measured, modelo e agent UUID persistido. Primeiro snapshot sem predecessor/delta é válido; sem soma de checkpoints ou atribuição à task. Legado/reconcile separados.

- 2026-11-03: fluxo de execuções/intervalos conforme especificação e contrato Backend: início antes executar, checkpoint, pausa/troca, resume novo intervalo e finish independente status/aceite. IDs e leituras explícitos; evidenceIds do report atual com unallocated, raiz/counterMode, finish pausado e coverageLost. Rollout opcional não cria fronteira implícita. Globais com backup/paridade; bundle separado.

- 2026-11-03: workScope e commitReport alinhados ao DTO estável Backend. Raiz real/worktree, remotes seguros, estados escopo, branch named/detached/unknown, disponibilidade e snapshot histórico. False/lista vazia legítimo, sem commits artificiais. Fonte/pacotes instaláveis com backup/paridade; API ativa não atualizada por esta frente.
