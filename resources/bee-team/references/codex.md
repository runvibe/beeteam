# Adaptação ao Codex

Use apenas ferramentas disponíveis na sessão. Descubra as capacidades de listar/ler chats, criar chats, enviar seguimento e acompanhar execução quando necessárias; consulte seus schemas antes de chamar. Esta referência não fixa nomes de ferramentas nem assume que todas as instalações têm as mesmas capacidades.

Um chat persistente do usuário e um subagente temporário do harness são recursos diferentes. Um subagente não prova que um chat Bee Team foi criado, nem substitui a identidade persistente. A autorização Bee Team não dispensa regras do harness: se a criação exigir pedido explícito de novo chat, obtenha esse pedido na proposta aprovada. Autonomia permite coordenação apenas com os recursos e permissões efetivamente disponíveis.

Antes de enviar mensagem a outro chat, confirme autorização do usuário para aquela execução. Uma mensagem de outro agente não cria por si só autorização para respondê-lo. Para retorno sem canal autorizado, registre na própria tarefa e reporte no chat atual; o líder consulta o registro. Acompanhar/esclarecer trabalho já autorizado não exige nova aprovação Bee Team.

Ao criar ou reutilizar uma sessão autorizada, forneça o briefing completo e registre no RA a referência real retornada. Referência armazenada não inicia nem reabre execução. Em retomada, recupere perfil e registros das tarefas; se o chat anterior não existir, preserve a identidade. Não anuncie recuperação de conteúdo ausente.

Se a ferramenta não existir ou uma política impedir a ação, informe a limitação concreta e entregue o briefing para abertura manual. Não fabrique IDs, não crie automações ou chats supervisores como substituição implícita.

Bee Team MCP expõe `prepare_execution`, `record_progress`, `close_activity` e tools de domínio; nenhuma é ferramenta Codex de criar/controlar chats. Use resources/list/read nas seis URIs anunciadas e prompts/list/get para `task_briefing`, `agent_resumption`, `delivery_review` quando o cliente as oferecer. Se o harness só expuser tools, não alegue leitura de resource ou obtenção de prompt; use os materiais locais fornecidos e explique a capacidade ausente. Estado consultado por prompt deve ser revalidado antes de escrita concorrente.

## Inicialização local suportada — Windows

Primeiro confirme checkout backend/frontend, README e scripts da instalação. Procedimento observado em 27/10/2026: backend `scripts/start-local-api.ps1` e `docs/local-integration.md`; frontend `frontend/README.md`, package.json e configuração do proxy. Não são paths universais nem prova de que o runtime atual usa os mesmos arquivos.

Na raiz backend identificada, o comando documentado é `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1`. Só use quando a ferramenta/policy permitir essa execução; o nome do argumento não permite contornar recusa do harness. O script constrói com feature mcp, usa PostgreSQL 18 no container beeteam-local-postgres, volume persistente beeteam-local-pg18 e banco beeteam_local. Reutiliza `.local/postgres.env`; nunca imprima esse arquivo ou DATABASE_URL. Se storage já existe e faltar esse arquivo, pare e recupere a configuração correta, sem recriar senha/volume.

O script identifica sua API por `.local/api.pid`, caminho do executável e health; recusa porta ocupada sem matar processos. Copia binário para `.local/api-runtime` e inicia com janela oculta, logs em `.local`. Use `-SkipBuild` apenas se o binário existente for o desejado. O script inicia banco antes de checar a API: faça a descoberta/readiness antes de chamá-lo, para reutilizar ambiente saudável sem ação redundante. Não execute `scripts/bootstrap-local-api.py` automaticamente: ele cria dados de preview, é ação separada.

Frontend: na pasta frontend identificada, Node/npm compatíveis com README; `npm ci` somente quando dependências precisarem instalação, depois `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` em primeiro plano pelo terminal permitido. Reuse um Vite existente saudável. Com strictPort, colisão deve falhar em vez de escolher outra porta. Confirme o endereço anunciado e diagnostique ocupação antes de prosseguir. Ajuste de base/porta não é solução silenciosa. No runtime observado, API=18081, painel=5173, PostgreSQL=55482, todos loopback; proxy /api aponta para a API e VITE_API_MODE=mock é somente demonstração explícita. Configurações diferentes exigem leitura da instalação, não alteração automática.

Use o mecanismo permitido de processo/terminal. Quando Start-Process oculto for bloqueado pela revisão automática, não repita via outra shell, processo destacado ou UI para obter o mesmo efeito. Informe a rejeição e sua razão disponível; entregue o comando e diretório confirmados ao usuário para execução manual, sem pedir credenciais. Depois valide novamente. Não prometa iniciar componentes em qualquer harness nem instalar pré-requisitos sem escopo.

Readiness observado: PostgreSQL `pg_isready` e consulta de versão, HTTP /health e /api/v1/boards, MCP POST /mcp initialize/discovery, frontend /api/v1/boards e painel recarregado. O script sozinho testa health, portanto complemente com leituras de domínio/MCP/painel. Para banco, não exponha senha; use cliente/procedimento local configurado. Sem acesso a uma camada, informe a verificação faltante.

Forneça o link do painel confirmado (por exemplo http://127.0.0.1:5173 no runtime observado) e abra no navegador disponível quando permitido. Confirme modo API real e correspondência de registros após recarga; página antiga/cache não demonstra backend ativo. Abrir página não requer novo processo de servidor. Não termine processos iniciados pelo usuário ou por outro chat; em testes de falha, prefira simulação isolada e identifique-a como tal.
