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
