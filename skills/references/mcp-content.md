# Conteúdo Bee Team para MCP

Esta referência define fontes editoriais e seu uso, não o catálogo autoritativo de tools, nomes públicos de prompts, URIs ou schemas de operações. O backend é responsável por esse catálogo, registro no SDK e testes reais. Não implica instalação global das skills nem capacidade já habilitada no servidor.

## Fontes únicas para empacotar

- `skills/bee-team-leader/SKILL.md` e `skills/bee-team-collaborator/SKILL.md`.
- Referências operacionais: `skills/references/handoff.md`, `integration.md`, `codex.md`, este arquivo e `skills/bee-team-leader/references/team-examples.md`.
- Templates: [briefing](../prompts/task-briefing.md), [retomada](../prompts/collaborator-resumption.md), [revisão](../prompts/delivery-review.md).
- [Manifesto de conteúdo](../prompts/content-manifest.json): arquivos e argumentos. Identificadores de arquivos são internos; nomes MCP serão definidos pelo backend.

Empacote conteúdo a partir desses arquivos, sem manter cópia manual divergente no código. Use uma allowlist explícita; não exponha árvore de filesystem, `.env`, arquivos pessoais, notas de progresso/validação ou segredos. Links relativos são referências editoriais: ao publicar recursos, o backend deve mapear dependências para URIs cadastradas, mantendo o conteúdo fonte único. Links para contratos só devem ser expostos se os documentos Bee Team correspondentes estiverem explicitamente empacotados; informe indisponibilidade em vez de abrir paths arbitrários.

## Uso pelo consumidor

Descubra capacidades anunciadas na inicialização. Quando presentes, `resources/list`/`resources/read` fornecem conteúdo estático permitido e `prompts/list`/`prompts/get` fornecem mensagens parametrizadas. Se ausentes, use os arquivos locais disponibilizados; não finja que o MCP os serviu. Ler resource ou obter prompt não executa IA, não abre chat, não concede aprovação nem escreve estado.

Os argumentos dos três templates são strings UUIDv7, obrigatórias conforme manifesto. Substitua apenas placeholders conhecidos `{{taskId}}`/`{{agentId}}`, uma vez, sem avaliação de código/template recursivo. O backend valida ausentes, desconhecidos e formatos antes de renderizar; IDs não são paths nem URIs. Não aceite flags de autonomia informadas pelo caller como prova: o consumidor consulta contexto atual pela API/MCP disponível. `prompts/get` pode devolver instrução textual para essa consulta; não prometa dados hidratados se não houve leitura.

Saída editorial prevista: uma mensagem textual de papel `user`, renderizada a partir do template. Não há JSON Schema de tool nesses arquivos; `PromptArgument` descreve nome, descrição e obrigatoriedade. Códigos de erro e nomes registrados pertencem ao catálogo central. Nenhum prompt contém mutação automática; o registro de conclusão só acontece em ação posterior autorizada.

## Relação com operações compostas

Preparar execução é consulta de contexto/task/plano/perfil/pendências/autonomia, sem iniciar execução. Registrar progresso combina comentário, andamento e bloqueios informados; checklist continua derivado das subtasks reais. Encerrar atividade registra resumo, entregas, pendências, status e revisão sem obrigar conclusão. Essas são descrições funcionais aprovadas, não nomes de ferramentas.

Descubra nomes/schemas no catálogo backend. Mutações compostas devem confirmar sucesso atômico, idempotência e versões conforme contrato central; não simule atomicidade fazendo várias escritas independentes e anunciando sucesso parcial como completo. Tools simples continuam disponíveis. Preparar contexto e consumir prompts não ampliam autorização nem resolvem a política pendente de edição pelo líder.

## Protocolo e SDK verificados

Em 27/10/2026, `Cargo.lock` e `cargo metadata --locked --features mcp` deste checkout apontam `rmcp 2.0.0`. O código dessa versão contém `ServerHandler::{list_resources,read_resource,list_prompts,get_prompt}` e `PromptArgument` em `src/model/prompt.rs`. Isso comprova pontos de extensão, não registro/funcionamento Bee Team. Nenhuma dependência foi alterada.

O protocolo documenta [resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) e [prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts), com anúncio de capacidades e list/get/read. Paginação dessas listas MCP usa cursor do protocolo; não confundir com offset/limit das entidades Bee Team. Não anuncie subscriptions, notificações ou recursos opcionais sem implementação.

## Aceitação da integração backend

Verificar no servidor real: descoberta das capacidades; list/read de toda allowlist; ausência de paths arbitrários e rejeição de URI desconhecida; list/get dos três prompts; parâmetros ausentes/extra/inválidos; texto renderizado sem placeholder residual; leitura sem mutação; recursos dependentes acessíveis; paridade com conteúdo fonte. Validar tools compostas, atomicidade e idempotência na frente backend. Teste editorial deste pacote não substitui esses testes de protocolo.
