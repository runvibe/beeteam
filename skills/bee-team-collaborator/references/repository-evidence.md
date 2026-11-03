# Projetos, repositórios e evidências de commits

## Projeto obrigatório, repositórios descobertos pelo Bee Team

Leader e Collaborator identificam os projetos realmente envolvidos no trabalho e informam nome e pasta raiz absoluta. Projeto é obrigatório; não substitua por indicação genérica de não se aplica ou por raiz fictícia. A especificação Markdown continua descrevendo requisitos/entrega/aceite, independente dos metadados estruturados. Não extraia vínculos automaticamente do texto.

Informe somente as pastas de projeto e worktrees usadas na demanda. Não enumere nem cadastre todas as worktrees de um repositório apenas porque compartilham objetos Git. A raiz é a pasta concreta de trabalho; não é lista de arquivos alterados nem diretório comum de metadados Git. Worktree com .git como arquivo é válida. Confirme o caminho absoluto disponível e a relação com a tarefa; ambiguidade ou falta de raiz deve ser resolvida antes de preencher o projeto, sem inventar diretório.

O agente NÃO informa repositórios, remotes, provider, URL web ou branch como entrada do escopo. Bee Team descobre Git/remotes/branch/worktree por inspeção local da raiz informada. Leia o resultado e os identificadores retornados antes de usar repositório em evidência de commit; não fabrique repositoryKey nem substitua a descoberta por descrição manual. Não confunda acesso do harness à pasta com acesso do processo Bee Team: hosts/contêineres podem enxergar caminhos diferentes. Não troque a raiz por outra para esconder falha de acesso.

Pasta de projeto sem Git é legítima; não inicialize Git nem crie remote para satisfazer cadastro. Pasta inacessível não prova ausência de Git: trate descoberta como pendente/indisponível conforme resultado real, registrando a limitação. Leia discovery.status: not_git indica inspeção bem-sucedida sem Git; unavailable indica impossibilidade de inspeção, nunca ausência comprovada de Git. Preserve nomes/raízes e registros existentes; não migre escopo legado por inferência.

## Inspeção do trabalho e proteção de credenciais

É permitido consultar o checkout autorizado para confirmar raiz e evidências do trabalho, por exemplo git rev-parse --show-toplevel quando houver Git. Isso não transfere ao agente a responsabilidade de preencher entrada de repositórios. Não exija .git diretório; não use git-common-dir como raiz de projeto nem varra pastas/worktrees alheias.

URLs de remote podem conter segredos. Não imprima configuração bruta nem faça git remote -v indiscriminadamente em saída visível. Antes de mostrar qualquer diagnóstico, saneie credenciais localmente; não copie usuário/senha/token HTTP, querystrings sensíveis ou esquemas executáveis para ferramentas, comentários, logs, arquivos ou links. Resultado de descoberta não autoriza divulgar segredos. URL SSH não vira URL web por substituição cega.

Para evidência de commit, confira branch/HEAD e hash completo reais. Detached HEAD e branch desconhecida usam representação explícita do contrato, nunca nome fabricado. Não altere checkout/configuração, crie commits ou faça push só para preencher campos. Repositório descoberto sem remote continua legítimo; disponibilidade remota não é inferida da existência do objeto local.

## Declaração em cada novo resumo

Antes de inserir um novo resumo, determine se houve commit efetivo no trabalho especificamente relatado. A declaração é booleana e a lista condicional segue os nomes/campos do contrato real. Sem commit, declarar false com lista vazia é válido para investigação, documentação ainda não comitada, checkpoint ou outras atividades. Não crie commit apenas para preencher o formulário nem declare todo HEAD atual como resultado desta atividade.

Se houve commit, declare true e ao menos uma referência completa por commit: repositório correto, branch contextual no momento do registro e hash completo verificado. Aceite múltiplos commits/repos quando realmente fizerem parte do trabalho. Confira escopo e conteúdo/histórico para não atribuir commits preexistentes ou de terceiros sem evidência de relação com a entrega. Se a relação for incerta, investigue e registre a limitação; não use false para ocultar commit conhecido nem invente referência para satisfazer true.

Hash identifica o commit; branch é contexto histórico, não posição mutável nem prova de publicação. Não substitua hash por HEAD, nome de branch ou hash curto. Preserve snapshots já registrados mesmo que branch mude depois. Alterações ainda não comitadas não são evidência de commit. A exigência de declarar não autoriza commit/push adicional fora do escopo solicitado.

## Local, publicado e links

Separe commit criado localmente, push confirmado e disponibilidade remota efetivamente verificada. Um objeto local, remote configurado ou branch de acompanhamento não comprovam publicação atual. Se só local, registre referência sem anunciar link remoto disponível. Links de commit são opcionais e só usam URL web segura, host suportado/configurado e disponibilidade confirmada. Não faça push apenas para produzir link. A descoberta reconhece github.com/gitlab.com; host próprio/desconhecido retorna provider other e webUrl null, ainda que remoteUrl seguro exista. Nesse caso não invente link; publicação realmente verificada pode ser declarada com commitUrl null.

A declaração é evidência fornecida pelo agente, não autenticação ou verificação remota automática pelo Bee Team. Não prometa que o servidor conferiu conteúdo, autoria, pertencimento atual à branch ou push. Não exponha credenciais em URLs persistidas mesmo que a API rejeite formatos inseguros.

## Persistência, legado e comunicação

A declaração e suas referências integram a gravação atômica do resumo/status junto aos demais requisitos, incluindo usageReport e executionTracking quando aplicável. Referência incompleta ou false com lista não vazia não autoriza salvamento parcial nem fallback para status sem resumo. Confirme persistência antes de comunicar; em timeout consulte estado e preserve chave/conteúdo idempotentes, sem duplicar referências.

Legado sem declaração permanece ausência, não false; não invente commits retroativos ou reescreva resumos antigos a partir do checkout atual. Comentários e avisos continuam pelo protocolo task/commentID; hash de commit, executionId e intervalId não substituem commentID. Falha de coleta/configuração é limitação factual, não permissão para IDs/paths/branches fictícios.

## Entrada de projetos e atualização explícita

CreateTask exige workScope com somente projects: de 1 a 100 entradas {key,name,rootPath}. key é identificador local estável escolhido pelo chamador, não UUID de entidade; name não vazio e rootPath absoluto. Não envie status, repositories ou discovery. PATCH substitui workScope pelo mesmo formato. Edição de specification em tarefa legada sem projeto válido exige workScope no mesmo PATCH; outras edições legadas continuam permitidas. Projeto válido já existente satisfaz essa exigência. Não preencha legado retroativamente por inferência.

Fragmento sintético de criação (demais campos obrigatórios da task omitidos):

```json
{"workScope":{"projects":[{"key":"app","name":"Aplicação","rootPath":"C:/projects/app"}]}}
```

Fragmento sintético de PATCH de specification legada, enviado com If-Match da versão atual:

```json
{"specification":"# Requisitos\nEntrega e critérios de aceite.","workScope":{"projects":[{"key":"app","name":"Aplicação","rootPath":"C:/projects/app"},{"key":"docs","name":"Documentação envolvida","rootPath":"C:/projects/docs"}]}}
```

Use caminhos reais autorizados no lugar destes exemplos; declare a segunda pasta somente se realmente envolvida. Para repetir a descoberta, reenvie a lista de projetos em PATCH com If-Match atual. Isso substitui o resultado atomicamente e incrementa a versão. Ler task ou editar outro campo não atualiza descoberta. Raiz inacessível/sem Git pode ser salva; raiz relativa/vazia ou lista vazia é inválida. Replay POST exato preserva resposta original e não repete descoberta.

## Resultado descoberto e evidência

Task.workScope permanece opcional no legado. Novas gravações retornam status identified porque os projetos foram declarados, mesmo se discovery falhar. Cada projeto mantém key/name/rootPath e recebe discovery: status detected/not_git/unavailable, reason, checkedAt, checkoutRoot, gitDirectory, commonDirectory, isWorktree, branch, headHash, repositoryKey e remotes. reason pode ser null, path_unavailable, git_unavailable, timeout, output_limit ou inspection_failed. Não exponha erros brutos nem segredos.

rootPath é a pasta declarada; checkoutRoot é o checkout Git que a contém e pode ser diferente. Repositórios são derivados dos projetos detected e agrupados pelo commonDirectory canônico; somente os projetos declarados entram em projectKeys. Use a key retornada, nunca reproduza seu algoritmo. Cada repositório retorna key/name/remoteUrl/webUrl/provider/projectKeys. Sem remote continua válido com URLs null; origin tem preferência, seguido do primeiro remote nomeado. Remotes inseguros podem ter URL null. Descoberta não faz fetch nem verifica publicação.

Todo novo RecordExecution exige commitReport. Sem commit no trabalho relatado:

```json
{"commitReport":{"hasCommits":false,"commits":[]}}
```

Formato ilustrativo de commit local; substitua repositoryKey e hash pelas evidências reais retornadas/verificadas, nunca envie estes marcadores:

```json
{"commitReport":{"hasCommits":true,"commits":[{"repositoryKey":"CHAVE_RETORNADA","branch":{"state":"named","name":"codex/exemplo"},"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","availability":"local","remoteVerifiedAt":null,"commitUrl":null}]}}
```

true exige 1..100 referências; hash completo hexadecimal de 40 ou 64 caracteres; sem duplicata repositoryKey/hash. named exige nome, detached/unknown usam name null. local/unknown exigem remoteVerifiedAt e commitUrl null; published exige verificação remota real com data RFC3339 e permite link opcional coerente com webUrl/provider. Snapshot repository é acrescentado pelo servidor, não é entrada. Escopo posterior não reescreve snapshots históricos.

Se commit conhecido não puder ser relacionado a repositório descoberto por falha de acesso, registre impedimento e reconcilie a descoberta; não declare false para contornar validação, não cadastre repo manualmente nem invente referência. Preserve também usageReport acumulado real e executionTracking quando aplicável.

Prompts continuam somente leitura: consultam escopo/descoberta e indicam lacunas; não gravam projetos, não comitam/fazem push nem produzem evidência artificial por serem obtidos. Instalar a skill não atualiza a API ativa.
