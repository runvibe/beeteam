# Bootstrap do Collaborator: chat antes do cadastro

## Leader prepara e aguarda

Após a aprovação aplicável da composição e da criação de chats, crie primeiro o CHAT do novo Collaborator. Não pré-cadastre seu perfil nem o anuncie pronto. No chat criado, peça explicitamente usar a skill bee-team-collaborator para se identificar/criar/configurar no Bee Team. Informe papel/contexto aprovados, time real e seu UUID confirmado, identidade existente quando houver e limites da autorização para criar/vincular. O time e a identidade da Leader podem ser preparados antes; esta ordem trata do perfil do Collaborator.

Peça retorno do NOME real quando pronto, acompanhado de agentId, teamId e prontidão em estrutura legível. Nome serve ao humano; IDs confirmados são as chaves de associação. Se só houver slug, resolva pelo endpoint/tool tipado; não derive UUID ou slug de nome/título. O título inicial pode usar 🐝 e o papel/nome proposto, sem tratá-lo como identidade persistida; o próprio Collaborator ajusta ao nome confirmado.

A criação do chat é assíncrona e não comprova cadastro nem prontidão. Aguarde retorno real pelo canal permitido e confira o cadastro/vínculo via Bee Team antes de atribuir trabalho. Se houver apenas nome, ID ausente, vínculo divergente ou status pending, não associe por similaridade nem presuma pronto. Reconcile somente a etapa faltante, sem duplicar perfil/chat. Somente depois da confirmação registre/atribua a task e envie a notificação de trabalho com commentID. Perfil pronto não confirma compreensão da task.

## Collaborator configura a própria identidade

Use a skill correspondente dentro do chat recebido. Consulte identidade/time e os contratos reais; reutilize perfil existente confirmado e preserve suas instruções, histórico e vínculos. Nome parecido não autoriza assumir identidade. Quando novo perfil estiver explicitamente autorizado e não houver cadastro a reutilizar, o próprio Collaborator cria/configura seu cadastro e vínculo ao time usando DTOs/versões/idempotência reais. Não crie outra identidade para contornar limite de equipe. Confirme persistência e leitura do perfil/vínculo antes de retornar ready.

Essa configuração cadastral autorizada não exige uma task de negócio e não permite criar task para autoautorizar trabalho. Se faltar acesso Bee Team, permissão, identidade inequívoca ou vínculo válido, retorne pending com o impedimento factual e IDs apenas se já confirmados; não anuncie nome proposto como cadastro criado. Timeout/retry exige consultar o resultado antes de repetir criação. Não instale integrações nem altere permissões implicitamente.

O retorno de bootstrap é uma mensagem de coordenação, não um novo DTO/API Bee Team. Use estrutura equivalente a `name`, `agentId`, `teamId`, `readiness` (ready/pending) e `pending` (impedimentos factuais). Em ready, nome e UUIDs vêm dos registros reais; em pending, campos desconhecidos ficam null. Exiba o nome legível junto à estrutura, nunca só UUID ou só nome como chave. Não inclua entrega, instruções de execução ou briefing de negócio nesse retorno.

## Exceção limitada e permissões

Somente pedido inicial e retorno de configuração/impedimento desse bootstrap dispensam task/commentID. Se retornar pending, o complemento cadastral estritamente necessário para resolver esse impedimento e seu novo retorno permanecem nesse bootstrap, dentro da autorização original, sem task artificial; não inclua negócio nem amplie composição/permissões. Depois, interações de trabalho seguem persistência na task, comentário completo, confirmação e aviso referencial com commentID. Não amplie a exceção para perguntas/decisões de negócio, atualizações de status ou retomadas comuns. Sem task atribuída, aguarde Leader/usuário; não inicie trabalho nem crie task própria.

A skill não autoriza ferramenta de chat por si só. Respeite exigências do harness para criar, enviar e receber. Sem envio autorizado, deixe o retorno disponível no próprio chat para leitura permitida pela Leader, sem fingir mensagem entregue. Chat persistente e subagente temporário são diferentes. Reutilização de chat escolhido e de perfil existente continua válida; não crie duplicata apenas para satisfazer esta sequência de novo cadastro.

## Exemplo de instrução inicial (não executar ao ler)

“Use a skill bee-team-collaborator neste chat. Configure sua identidade no Bee Team para o papel/contexto aprovados e o time de UUID confirmado informado. Consulte e reutilize o perfil existente se indicado; crie um novo somente dentro da autorização recebida. Quando a persistência e o vínculo estiverem confirmados, retorne seu NOME real junto de agentId, teamId e readiness. Se houver impedimento, retorne pending com o motivo. Aguarde atribuição registrada antes de trabalhar.”

Substitua referências somente por valores reais; este exemplo não cria chat, perfil ou task. Prompts MCP de briefing/retomada/revisão permanecem somente leitura e não executam bootstrap nem produzem confirmação real de prontidão.
