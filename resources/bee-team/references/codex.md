# Adaptação ao Codex

Use apenas ferramentas disponíveis na sessão. Descubra as capacidades de listar/ler chats, criar chats, enviar seguimento e acompanhar execução quando necessárias; consulte seus schemas antes de chamar. Esta referência não fixa nomes de ferramentas nem assume que todas as instalações têm as mesmas capacidades.

Um chat persistente do usuário e um subagente temporário do harness são recursos diferentes. Um subagente não prova que um chat Bee Team foi criado, nem substitui a identidade persistente. A autorização Bee Team não dispensa regras do harness: se a criação exigir pedido explícito de novo chat, obtenha esse pedido na proposta aprovada. Autonomia permite coordenação apenas com os recursos e permissões efetivamente disponíveis.

Antes de enviar mensagem a outro chat, confirme autorização do usuário para aquela execução. Uma mensagem de outro agente não cria por si só autorização para respondê-lo. Para retorno sem canal autorizado, registre na própria tarefa e reporte no chat atual; o líder consulta o registro. Acompanhar/esclarecer trabalho já autorizado não exige nova aprovação Bee Team.

Ao criar ou reutilizar uma sessão autorizada, forneça o briefing completo e registre no RA a referência real retornada. Referência armazenada não inicia nem reabre execução. Em retomada, recupere perfil e registros das tarefas; se o chat anterior não existir, preserve a identidade. Não anuncie recuperação de conteúdo ausente.

Se a ferramenta não existir ou uma política impedir a ação, informe a limitação concreta e entregue o briefing para abertura manual. Não fabrique IDs, não crie automações ou chats supervisores como substituição implícita.

Bee Team MCP expõe `prepare_execution`, `record_progress`, `close_activity` e tools de domínio; nenhuma é ferramenta Codex de criar/controlar chats. Use resources/list/read nas seis URIs anunciadas e prompts/list/get para `task_briefing`, `agent_resumption`, `delivery_review` quando o cliente as oferecer. Se o harness só expuser tools, não alegue leitura de resource ou obtenção de prompt; use os materiais locais fornecidos e explique a capacidade ausente. Estado consultado por prompt deve ser revalidado antes de escrita concorrente.

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

Aceite em duas camadas: servidor responde initialize e anuncia tools/resources/prompts; sessão expõe ferramentas Bee Team e executa leitura real, por exemplo listBoards com schema descoberto. Uma chamada HTTP direta de diagnóstico não comprova exposição nativa. Liste/leia resources e obtenha prompts apenas se o cliente oferecer essas capacidades; informe o que ficou indisponível. Não prometa que todas as seis URIs/três prompts são utilizáveis só porque o servidor as anunciou. Handoff registra endpoint, host/escopo, leitura validada e eventual atualização de sessão pendente, sem segredos.

Fontes oficiais consultadas em 27/10/2026: [OpenAI — MCP e configuração Codex](https://developers.openai.com/codex/mcp) e [comandos codex mcp](https://learn.chatgpt.com/docs/developer-commands#codex-mcp). Sintaxe `add --url` também conferida em `codex mcp add --help` local. Os exemplos acima são instruções; sua presença no pacote não configura a conta.

## Inicialização local suportada — Windows

Primeiro confirme checkout backend/frontend, README e scripts da instalação. Procedimento observado em 27/10/2026: backend `scripts/start-local-api.ps1` e `docs/local-integration.md`; frontend `frontend/README.md`, package.json e configuração do proxy. Não são paths universais nem prova de que o runtime atual usa os mesmos arquivos.

Na raiz backend identificada, o comando documentado é `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1`. Só use quando a ferramenta/policy permitir essa execução; o nome do argumento não permite contornar recusa do harness. O script constrói com feature mcp, usa PostgreSQL 18 no container beeteam-local-postgres, volume persistente beeteam-local-pg18 e banco beeteam_local. Reutiliza `.local/postgres.env`; nunca imprima esse arquivo ou DATABASE_URL. Se storage já existe e faltar esse arquivo, pare e recupere a configuração correta, sem recriar senha/volume.

O script identifica sua API por `.local/api.pid`, caminho do executável e health; recusa porta ocupada sem matar processos. Copia binário para `.local/api-runtime` e inicia com janela oculta, logs em `.local`. Use `-SkipBuild` apenas se o binário existente for o desejado. O script inicia banco antes de checar a API: faça a descoberta/readiness antes de chamá-lo, para reutilizar ambiente saudável sem ação redundante. Não execute `scripts/bootstrap-local-api.py` automaticamente: ele cria dados de preview, é ação separada.

Frontend: na pasta frontend identificada, Node/npm compatíveis com README; `npm ci` somente quando dependências precisarem instalação, depois `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` em primeiro plano pelo terminal permitido. Reuse um Vite existente saudável. Com strictPort, colisão deve falhar em vez de escolher outra porta. Confirme o endereço anunciado e diagnostique ocupação antes de prosseguir. Ajuste de base/porta não é solução silenciosa. No runtime observado, API=18081, painel=5173, PostgreSQL=55482, todos loopback; proxy /api aponta para a API e VITE_API_MODE=mock é somente demonstração explícita. Configurações diferentes exigem leitura da instalação, não alteração automática.

Use o mecanismo permitido de processo/terminal. Quando Start-Process oculto for bloqueado pela revisão automática, não repita via outra shell, processo destacado ou UI para obter o mesmo efeito. Informe a rejeição e sua razão disponível; entregue o comando e diretório confirmados ao usuário para execução manual, sem pedir credenciais. Depois valide novamente. Não prometa iniciar componentes em qualquer harness nem instalar pré-requisitos sem escopo.

Readiness observado: PostgreSQL `pg_isready` e consulta de versão, HTTP /health e /api/v1/boards, MCP POST /mcp initialize/discovery, frontend /api/v1/boards e painel recarregado. O script sozinho testa health, portanto complemente com leituras de domínio/MCP/painel. Para banco, não exponha senha; use cliente/procedimento local configurado. Sem acesso a uma camada, informe a verificação faltante.

Forneça o link do painel confirmado (por exemplo http://127.0.0.1:5173 no runtime observado) e abra no navegador disponível quando permitido. Confirme modo API real e correspondência de registros após recarga; página antiga/cache não demonstra backend ativo. Abrir página não requer novo processo de servidor. Não termine processos iniciados pelo usuário ou por outro chat; em testes de falha, prefira simulação isolada e identifique-a como tal.
