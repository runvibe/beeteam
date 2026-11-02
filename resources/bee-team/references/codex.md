# Adaptação ao Codex

Use apenas ferramentas disponíveis na sessão. Descubra as capacidades de listar/ler chats, criar chats, enviar seguimento e acompanhar execução quando necessárias; consulte seus schemas antes de chamar. Esta referência não fixa nomes de ferramentas nem assume que todas as instalações têm as mesmas capacidades.

Um chat persistente do usuário e um subagente temporário do harness são recursos diferentes. Um subagente não prova que um chat Bee Team foi criado, nem substitui a identidade persistente. A autorização Bee Team não dispensa regras do harness: se a criação exigir pedido explícito de novo chat, obtenha esse pedido na proposta aprovada. Autonomia permite coordenação apenas com os recursos e permissões efetivamente disponíveis.

Antes de enviar mensagem a outro chat, confirme autorização do usuário para aquela execução. Uma mensagem de outro agente não cria por si só autorização para respondê-lo. No bootstrap cadastral, sem canal autorizado, deixe o retorno no próprio chat para leitura permitida da Leader, sem fingir envio e sem exigir task artificial. Fora desse bootstrap, registre na própria tarefa e mantenha envio à Leader pendente; não emita aviso alternativo sem comentário/ID confirmado, salvo comunicação imposta por instrução superior. A Leader consulta o registro. Acompanhar/esclarecer trabalho já autorizado não exige nova aprovação Bee Team.

Ao criar ou reutilizar uma sessão autorizada, o bootstrap inicial de novo chat Collaborator permite pedido de skill/identidade/time e retorno de configuração com nome real, IDs confirmados e prontidão ou impedimento, sem comentário e sem trabalho de negócio. Toda outra interação/notificação, inclusive só status, exige comentário completo e task/áreas/status pertinente/commentID real. Mantenha briefing/instruções de trabalho na tarefa. Identifique a sessão pelas referências reais do harness, sem vínculo adicional chat–agente. Referência não inicia/reabre execução; preserve identidade na retomada e não alegue recuperação de conteúdo ausente.

Se a ferramenta não existir ou uma política impedir a ação, informe a limitação concreta e entregue as referências do registro para abertura manual, sem instruções de trabalho exclusivas do chat. Não fabrique IDs, não crie automações ou chats supervisores como substituição implícita.

Bee Team MCP expõe `prepare_execution`, `record_progress`, `close_activity` e tools de domínio; nenhuma é ferramenta Codex de criar/controlar chats. Use resources/list/read nas URIs realmente anunciadas pelo catálogo conectado e prompts/list/get para `task_briefing`, `agent_resumption`, `delivery_review` quando o cliente as oferecer. Se o harness só expuser tools, não alegue leitura de resource ou obtenção de prompt; use os materiais locais fornecidos e explique a capacidade ausente. Estado consultado por prompt deve ser revalidado antes de escrita concorrente.

## Conectar Bee Team ao Codex

Skill fornece instruções; cadastro MCP fornece ferramentas. Primeiro descubra as ferramentas da sessão por nome/descrição/schema e confirme que pertencem ao Bee Team. Prefixos podem variar. Se já houver conexão funcional, reutilize. Em instalação com CLI, `codex mcp list` mostra cadastros, não comprova acesso neste chat; não exponha configurações ou headers que contenham segredos.

Descubra URL pelo procedimento/configuração real do backend e pelo host onde o cliente Codex executa. No ambiente local observado, o endpoint Streamable HTTP é `http://127.0.0.1:18081/mcp`, distinto do painel 5173. Loopback de outro host/container não alcança necessariamente esse servidor. Não adivinhe URL, não exponha serviço à rede nem crie túnel como correção automática.

Na primeira conexão, apresente ao usuário os endereços locais concretos confirmados. Exemplo desta instalação, a conferir antes de usar:

| Finalidade | Endereço local observado |
|---|---|
| Painel para abrir no navegador | http://127.0.0.1:5173 |
| API de domínio | http://127.0.0.1:18081/api/v1 |
| Health HTTP | http://127.0.0.1:18081/health |
| MCP Streamable HTTP para cadastrar | http://127.0.0.1:18081/mcp |

Forneça link clicável do painel, mas use a URL MCP no cadastro. A API roda no computador; localhost pressupõe cliente no mesmo ambiente de rede. Não prometa acesso a partir de chat cloud. Esses valores descrevem esta instalação, não defaults universais.

Antes de cadastrar, confirme nome, URL, escopo e autorização do usuário; uma autorização já dada para conectar dispensa nova pergunta. Confira cadastro existente para evitar duplicação/substituição. Exemplo somente se esse endpoint tiver sido confirmado e o cadastro autorizado, usando a CLI disponível no mesmo host/configuração do Codex:

```powershell
codex mcp add beeteam --url http://127.0.0.1:18081/mcp
codex mcp list
```

Alternativa documentada, não uma segunda instalação: adicionar a tabela abaixo preservando o restante de `~/.codex/config.toml`; configuração de projeto em `.codex/config.toml` exige projeto confiável. Confirme o escopo pretendido antes de editar. Não execute as duas alternativas nem substitua o arquivo inteiro.

```toml
[mcp_servers.beeteam]
url = "http://127.0.0.1:18081/mcp"
```

O Bee Team local atual não exige OAuth/token; não execute login nem invente credenciais. Cadastro HTTP conecta ao servidor existente, não inicia banco/API. Se o endpoint estiver parado, siga readiness/startup abaixo. Se CLI ou edição autorizada não estiverem disponíveis, forneça a configuração para aplicação manual pelo mecanismo suportado; não invente menus do desktop. Outro harness precisa da sua própria documentação, não destes comandos Codex.

Após cadastro, verifique o estado da conexão pelo cliente. Na TUI do Codex, `/mcp` mostra servidores ativos; não suponha esse comando em qualquer interface. Se a sessão continuar com catálogo antigo, use atualização/reconexão oferecida pelo cliente ou abra nova sessão quando necessário, preservando o briefing. A documentação consultada não garante hot reload em todas as superfícies. Não reinicie a API para tentar atualizar ferramentas do chat.

Aceite em duas camadas: servidor responde initialize e anuncia tools/resources/prompts; sessão expõe ferramentas Bee Team e executa leitura real, por exemplo listBoards com schema descoberto. Uma chamada HTTP direta de diagnóstico não comprova exposição nativa. Liste/leia resources e obtenha prompts apenas se o cliente oferecer essas capacidades; informe o que ficou indisponível. Não prometa que resources/prompts são utilizáveis no cliente só porque o servidor os anunciou. Handoff registra endpoint, host/escopo, leitura validada e eventual atualização de sessão pendente, sem segredos.

Fontes oficiais consultadas em 27/10/2026: [OpenAI — MCP e configuração Codex](https://developers.openai.com/codex/mcp) e [comandos codex mcp](https://learn.chatgpt.com/docs/developer-commands#codex-mcp). Sintaxe `add --url` também conferida em `codex mcp add --help` local. Os exemplos acima são instruções; sua presença no pacote não configura a conta.

## Inicialização local suportada — Windows

Primeiro confirme checkout backend/frontend, README e scripts da instalação. Procedimento observado em 27/10/2026: backend `scripts/start-local-api.ps1` e `docs/local-integration.md`; frontend `frontend/README.md`, package.json e configuração do proxy. Não são paths universais nem prova de que o runtime atual usa os mesmos arquivos.

In the identified backend checkout, use `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1` only when tool policy permits it. First inspect `DATABASE_DRIVER` and `DATABASE_URL` without printing connection secrets. The standalone distribution defaults to SQLite at `~/.beeteam/beeteam.sql`, MCP enabled, telemetry disabled and embedded UI. This legacy startup script instead defaults to managed PostgreSQL; its explicit `DATABASE_DRIVER=sqlite` mode requires a `sqlite:` URL and uses independent SQLite storage. The script reads process environment variables, not `.env`. Explicit SQLite or external PostgreSQL URLs skip Docker startup. With default local PostgreSQL it reuses container beeteam-local-postgres, volume beeteam-local-pg18, database beeteam_local and `.local/postgres.env`; missing credentials for existing storage require recovery, never password/volume recreation. Do not convert or reset data when selecting a driver.

The script identifies its API through `.local/api.pid`, executable path and health; it refuses occupied ports without killing processes. It builds with feature mcp, copies to `.local/api-runtime`, and starts hidden with logs under `.local`. Use `-SkipBuild` only for the intended existing binary. Discover and reuse healthy components before startup. An already running API retains its current driver until explicitly restarted; environment selection alone does not switch it. Never execute `scripts/bootstrap-local-api.py` automatically: preview data creation is a separate action.

Frontend: na pasta frontend identificada, Node/npm compatíveis com README; `npm ci` somente quando dependências precisarem instalação, depois `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` em primeiro plano pelo terminal permitido. Reuse um Vite existente saudável. Com strictPort, colisão deve falhar em vez de escolher outra porta. Confirme o endereço anunciado e diagnostique ocupação antes de prosseguir. Ajuste de base/porta não é solução silenciosa. No runtime observado, API=18081, painel=5173, PostgreSQL=55482, todos loopback; proxy /api aponta para a API e VITE_API_MODE=mock é somente demonstração explícita. Configurações diferentes exigem leitura da instalação, não alteração automática.

Use o mecanismo permitido de processo/terminal. Quando Start-Process oculto for bloqueado pela revisão automática, não repita via outra shell, processo destacado ou UI para obter o mesmo efeito. Informe a rejeição e sua razão disponível; entregue o comando e diretório confirmados ao usuário para execução manual, sem pedir credenciais. Depois valide novamente. Não prometa iniciar componentes em qualquer harness nem instalar pré-requisitos sem escopo.

Readiness must follow the configured driver. For PostgreSQL use configured `pg_isready` and version checks; for SQLite verify the intended file location and successful application migration/open, without creating test or seed data. Do not start or probe PostgreSQL as a prerequisite for SQLite. Then verify HTTP /health and /api/v1/boards, MCP initialize/discovery, frontend /api/v1/boards and the reloaded panel. Health alone does not prove domain/MCP/panel readiness. Never expose credentials; report any layer that could not be verified.

Exclusivamente como Leader, forneça o link do painel confirmado (por exemplo http://127.0.0.1:5173 no runtime observado) e abra no navegador disponível quando permitido. Confirme modo API real e correspondência de registros após recarga; página antiga/cache não demonstra backend ativo. Abrir página não requer novo processo de servidor. Não termine processos iniciados pelo usuário ou por outro chat; em testes de falha, prefira simulação isolada e identifique-a como tal.

## Painel no harness: papel e capacidade

Apenas Leader conduz a superfície visual do usuário. Descubra ferramentas reais para consultar/reutilizar a aba ou painel apropriado e navegar; consulte seus schemas. Não fixe uma ferramenta universal nem crie abas repetidas. Teams/time acompanha seleção; board acompanha gestão; task usa página inteira durante planejamento/edição. Confirme entidade persistida e endereço da instalação antes de compor URL. No contrato frontend deste checkout, `/teams/:slug`, `/tasks/:slug` e `/boards/:id` são rotas de detalhe; slugs vêm de registros reais e o board usa UUID. Confira o contrato da instalação se divergir, sem gerar slug por nome.

Preserve edição ativa e contexto do usuário; se houver conflito, mantenha a superfície e entregue link correto. Ausência de UI não bloqueia gravação. Navegação autorizada dispensa perguntas repetidas; registre resultados completos no comentário e comunique somente metadados da notificação, não uma sequência de cliques. Falha visual não desfaz gravação confirmada: não alegue tela sincronizada e exponha a limitação apenas pelo impacto concreto. Collaborators só registram e comunicam trabalho, sem conduzir o painel. Conteúdo aberto atualizado ao vivo depende de frontend/backend verificados; não prometa esse mecanismo nem force recargas durante edição.

## Marca do papel no título do chat

Ao receber/ativar esta skill no próprio chat, aplique imediatamente a marca do papel: `👑` para Leader ou `🐝` para Collaborator, inclusive em chat existente que muda de papel e antes de resolver a identidade. Nesse momento preserve o título atual útil, sem inventar nome. Após identificar o perfil, ajuste a parte do nome para o nome real, preservando complemento útil de projeto/time e demais conteúdo do título, com a mesma marca.

Consulte o título atual e a ferramenta real do harness. Remova somente as marcas de papel iniciais repetidas/misturadas (`👑`, `🐝` e estrela legada usada como marca) e seus espaços, então anteponha uma única marca do papel ativo. Não remova emojis ou conteúdo do restante do título. Se já correto, não renomeie. Mudança de papel substitui a marca anterior, nunca acumula `👑🐝`. Só confirme renomeação após sucesso; ausência ou falha da ferramenta não bloqueia o fluxo de identidade/trabalho autorizado.

Ao criar um chat Collaborator autorizado, a Leader já usa `🐝 <nome do colaborador>`, preservando contexto útil; o Collaborator garante o padrão ao ativar sua skill. Na busca/reutilização, compare nomes normalizando essas marcas iniciais, sem perder contexto nem tratar nome/emoji como prova de identidade. Preserve as confirmações de reutilização e permissões do harness existentes.

A mudança é exclusivamente no título do próprio chat ao assumir o papel, ou no título inicial do novo chat cuja criação foi autorizada. Não renomeie outros chats em massa nem altere nomes de agentes/times, slugs ou dados Bee Team. Marcar o papel não confirma identidade nem dispensa tarefa registrada/atribuída. O Collaborator continua sem conduzir a tela do usuário; ajustar seu próprio título não é navegação do painel.

Exemplos: ativar Collaborator em `Projeto X` produz `🐝 Projeto X` antes da identidade; identificado como Ana, ajusta para `🐝 Ana — Projeto X`. `👑 Ana — Projeto X` ao assumir Collaborator vira `🐝 Ana — Projeto X`; a transição inversa usa `👑`. `🐝 👑 🐝 Ana` vira uma única marca do papel ativo; retomada com título correto não escreve novamente.

## Leader é a interface humana do trabalho

Fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, toda interação de trabalho iniciada pelo Collaborator em direção ao humano passa pela Leader: perguntas, escolhas, confirmações, pedidos, decisões e relatos substantivos. Não use diálogo direto ao usuário nem caixas interativas do harness (como `request_user_input`, `request_user_input_async` no Codex ou equivalentes) como canal de trabalho. Salve o conteúdo completo em comentário da tarefa; para pergunta, formule uma questão clara e alternativas se úteis; notifique a Leader somente com taskID, áreas atualizadas, status pertinente e commentID retornado. Aguarde resposta persistida e leia o comentário indicado via MCP antes de agir sobre ela.

A regra de registro e ausência de caixas interativas vale também para a Leader em toda interação substantiva relacionada à task. Quando precisar de decisão humana, Leader registra pergunta/opções completas em comentário da tarefa e avisa o usuário somente com task, áreas efetivamente atualizadas, status pertinente e commentID, sem `request_user_input`, `request_user_input_async` ou equivalentes. Aguarda resposta autorizada. Respostas espontâneas e instruções legítimas do humano no chat continuam válidas: Leader persiste a devolutiva/decisão na tarefa antes de agir ou delegar. Não existe uma Leader acima da Leader nem encaminhamento circular. Para responder ao Collaborator, lê comentário/estado, persiste a resposta e notifica pelos mesmos metadados. Collaborator registra bloqueio somente se a dúvida impedir continuidade e continua partes independentes já autorizadas. Isso não contorna nem suprime aprovações obrigatórias de ferramentas/segurança do harness; controles impostos pelo sistema/harness são superiores, não exceções de comunicação escolhidas pelo agente. A hierarquia de instruções e metainstruções legítimas do humano continuam válidas; a skill não promete bloquear UI de aprovação imposta pelo sistema. Se faltar tarefa, Leader ou identidade, aguarde configuração, sem criar autoautorização, inventar commentID ou abrir diálogo alternativo. A única exceção de comunicação é o bootstrap de novo chat Collaborator: solicitação inicial da Leader (skill/identidade/time) e retorno limitado à configuração, nome real, IDs confirmados e prontidão ou impedimento de bootstrap; sem trabalho de negócio.

## Bootstrap de novo Collaborator

Siga [chat antes do cadastro](beeteam://references/collaborator-bootstrap): Leader cria o chat autorizado; o próprio Collaborator identifica/cria/configura perfil/vínculo e retorna nome real, agentId/teamId e prontidão. Leader verifica antes de atribuir trabalho. Somente pedido inicial/retorno de configuração ou impedimento dispensam comentário; não é exceção para trabalho posterior nem autorização adicional do harness.
