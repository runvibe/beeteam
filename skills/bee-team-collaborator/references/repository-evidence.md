# Projetos, repositórios e evidências de commits

## Escopo estruturado independente do Markdown

Leader e Collaborator consultam o escopo real da task e os checkouts disponíveis antes de registrar projetos/repositórios. A especificação Markdown continua descrevendo requisitos/entrega/aceite; não extraia vínculos automaticamente do texto nem substitua specification pelos metadados estruturados.

Projeto registra nome e pasta raiz local de trabalho, inclusive worktree cujo .git seja arquivo; não liste arquivos/pastas modificados como projetos. Repositório registra nome, remote e URL web segura quando disponível, relacionado explicitamente aos projetos. Vários projetos/repos são possíveis. Preserve a distinção identificado, a identificar e não se aplica conforme contrato: investigação sem checkout confirmado não inventa raiz; trabalho sem Git não recebe repo fictício. Ausência legada não é declaração nova de não se aplica.

Consulte o escopo salvo antes de atualizar, confirme versões e preserve relações existentes. Só declare escopo identificado com evidência; ambiguidade real deve ficar explícita. Não crie registro de projeto/repositório ou campos JSON fora do contrato efetivamente exposto. Não derive IDs, URLs ou relações pelo nome.

## Inspecionar Git sem divulgar credenciais

No diretório autorizado, confirme se há Git e determine a raiz de trabalho com git rev-parse --show-toplevel; não exija que .git seja diretório e não use diretório comum de metadados como raiz do projeto. Inspecione status, histórico e estado de HEAD para distinguir alterações não comitadas de commits existentes. Worktrees compartilham objetos, mas podem ter raízes e branches diferentes: relate o checkout efetivamente usado.

Descubra remotes sem imprimir a configuração bruta. URLs podem conter usuário/senha/token; leia e saneie localmente antes de mostrar ou persistir, sem incluir credenciais em ferramentas, comentários, logs, arquivos ou links. Não faça git remote -v indiscriminadamente em saída visível. Não exponha querystrings sensíveis, esquemas executáveis ou dados locais não necessários. Nome de remote (por exemplo origin) sozinho não prova qual repositório é o correto; confirme a relação com o trabalho.

Confirme branch do checkout e hash completo dos commits por Git. Em detached HEAD use branch.state detached/name null; branch não identificável usa unknown/name null; sem remote use remoteUrl null. Preserve a condição; nunca invente branch/main ou URL para preencher validação. Não altere checkout, branch ou configuração só para obter um valor exigido. URL SSH não vira URL web por substituição cega; use host reconhecido/configurado e validação segura.

## Declaração em cada novo resumo

Antes de inserir um novo resumo, determine se houve commit efetivo no trabalho especificamente relatado. A declaração é booleana e a lista condicional segue os nomes/campos do contrato real. Sem commit, declarar false com lista vazia é válido para investigação, documentação ainda não comitada, checkpoint ou outras atividades. Não crie commit apenas para preencher o formulário nem declare todo HEAD atual como resultado desta atividade.

Se houve commit, declare true e ao menos uma referência completa por commit: repositório correto, branch contextual no momento do registro e hash completo verificado. Aceite múltiplos commits/repos quando realmente fizerem parte do trabalho. Confira escopo e conteúdo/histórico para não atribuir commits preexistentes ou de terceiros sem evidência de relação com a entrega. Se a relação for incerta, investigue e registre a limitação; não use false para ocultar commit conhecido nem invente referência para satisfazer true.

Hash identifica o commit; branch é contexto histórico, não posição mutável nem prova de publicação. Não substitua hash por HEAD, nome de branch ou hash curto. Preserve snapshots já registrados mesmo que branch mude depois. Alterações ainda não comitadas não são evidência de commit. A exigência de declarar não autoriza commit/push adicional fora do escopo solicitado.

## Local, publicado e links

Separe commit criado localmente, push confirmado e disponibilidade remota efetivamente verificada. Um objeto local, remote configurado ou branch de acompanhamento não comprovam publicação atual. Se só local, registre referência sem anunciar link remoto disponível. Links de commit são opcionais e só usam URL web segura, host suportado/configurado e disponibilidade confirmada. Não faça push apenas para produzir link. Preserve GitHub/GitLab e hosts próprios quando reconhecidos, sem adivinhar roteamento do host.

A declaração é evidência fornecida pelo agente, não autenticação ou verificação remota automática pelo Bee Team. Não prometa que o servidor conferiu conteúdo, autoria, pertencimento atual à branch ou push. Não exponha credenciais em URLs persistidas mesmo que a API rejeite formatos inseguros.

## Persistência, legado e comunicação

A declaração e suas referências integram a gravação atômica do resumo/status junto aos demais requisitos, incluindo usageReport e executionTracking quando aplicável. Referência incompleta ou false com lista não vazia não autoriza salvamento parcial nem fallback para status sem resumo. Confirme persistência antes de comunicar; em timeout consulte estado e preserve chave/conteúdo idempotentes, sem duplicar referências.

Legado sem declaração permanece ausência, não false; não invente commits retroativos ou reescreva resumos antigos a partir do checkout atual. Comentários e avisos continuam pelo protocolo task/commentID; hash de commit, executionId e intervalId não substituem commentID. Falha de coleta/configuração é limitação factual, não permissão para IDs/paths/branches fictícios.

## Contrato confirmado

Task/CreateTask/PatchTask.workScope é opcional e contém status, projects e repositories (TaskWorkScope). status aceita identified/to_identify/not_applicable. Projeto é {key,name,rootPath}; rootPath é raiz absoluta literal do checkout, nunca executada/aberta pelo servidor. Repositório é {key,name,remoteUrl,webUrl,provider,projectKeys}; URLs aceitam null, provider é github/gitlab/other e projectKeys referencia explicitamente keys dos projetos nessa mesma declaração. Keys são identificadores locais fornecidos pelo chamador (letras/dígitos/ponto/hífen/underscore, até80 caracteres, começando alfanumérico), não UUIDs de entidades. Não confundir com IDs persistidos de task/agente.

identified exige ao menos um projeto; to_identify permite lista parcial; not_applicable exige ambas listas vazias. Até100 projetos e100 repositórios, keys distintas por lista. Substitua o workScope completo atomicamente via updateTask/PATCH com a versão da task, preservando relações não alteradas. Não derive metadados do Markdown. Escopo legado ausente continua ausente; não invente preenchimento retroativo.

Todo novo RecordExecution exige commitReport (CommitReportInput) em createExecutionSummary e close_activity.execution: {hasCommits:boolean,commits:[]}. false exige lista vazia; true exige1..100 referências, sem duplicata repositoryKey/hash. Cada referência declara repositoryKey, branch, hash, availability, remoteVerifiedAt e commitUrl. repositoryKey deve resolver no workScope atual da task: prepare/confirme o escopo antes de registrar commit; não envie snapshot de repository no input. O servidor acrescenta esse snapshot completo na resposta histórica, preservando-o mesmo após editar o escopo.

branch é {state,name}: named exige nome não vazio; detached e unknown exigem name null. Não usar nome de branch encontrado hoje como substituto do contexto histórico informado na gravação. hash é hexadecimal completo de40 ou64 dígitos. availability aceita local/published/unknown. published exige remoteVerifiedAt RFC3339 de verificação real; local/unknown exigem remoteVerifiedAt e commitUrl null. Um commit publicado pode ter commitUrl null. A declaração não causa verificação remota automática pelo servidor.

Se commitUrl for fornecida, precisa de provider reconhecido e webUrl explícita: github usa webUrl/commit/hash; gitlab usa webUrl/-/commit/hash, inclusive host próprio configurado. O hash completo do link corresponde ao campo hash; não invente disponibilidade para habilitar link. URLs web/HTTP remotas rejeitam userinfo, query e fragmento; links só HTTP(S). Remote SSH aceita login SSH sem senha (não é token HTTP); não imprimir configuração bruta nem transformar SSH em web automaticamente. Remote local sem URL suportada usa null, não file:// ou comando ext::.

Ausência de commitReport em legado não vira false. Replay POST/composto salvo precede validação nova e conserva resposta; nova gravação não usa a exceção legada. Campos, status, resumo, evidências de commit/uso e tracking opcional são atômicos na operação. Erro não autoriza anunciar áreas parcialmente salvas nem alterar status por outro caminho. API ativa pode ainda estar na versão anterior: instalar esta skill não publica o contrato no servidor; confira catálogo e sinalize divergência sem alegar atualização de runtime.

## Exemplos sintéticos, não executar

Os exemplos abaixo são fragmentos de corpo: workScope para CreateTask/PatchTask e commitReport para RecordExecution. Não são envelopes completos de tool/HTTP e não autorizam mutações. Nomes, raízes, hashes, URLs e verificação remota são fictícios; substituir por evidências reais, nunca enviar estes valores de demonstração. Nos exemplos true, repositoryKey core refere-se ao escopo de exemplo identificado.

Escopo identificado:

```json
{
  "workScope": {
    "status": "identified",
    "projects": [
      {
        "key": "app",
        "name": "Aplicação de exemplo",
        "rootPath": "C:/work/example-checkout"
      }
    ],
    "repositories": [
      {
        "key": "core",
        "name": "Core de exemplo",
        "remoteUrl": "git@git.example:group/core.git",
        "webUrl": "https://git.example/group/core",
        "provider": "gitlab",
        "projectKeys": [
          "app"
        ]
      }
    ]
  }
}
```

A identificar, sem checkout confirmado:

```json
{
  "workScope": {
    "status": "to_identify",
    "projects": [],
    "repositories": []
  }
}
```

Trabalho sem projetos/repos aplicáveis:

```json
{
  "workScope": {
    "status": "not_applicable",
    "projects": [],
    "repositories": []
  }
}
```

Resumo sem commit (investigação/checkpoint):

```json
{
  "commitReport": {
    "hasCommits": false,
    "commits": []
  }
}
```

Resumo com commits: branch named publicada, detached local e branch/ disponibilidade desconhecidas:

```json
{
  "commitReport": {
    "hasCommits": true,
    "commits": [
      {
        "repositoryKey": "core",
        "branch": {
          "state": "named",
          "name": "feature/example"
        },
        "hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "availability": "published",
        "remoteVerifiedAt": "2026-11-03T12:00:00Z",
        "commitUrl": "https://git.example/group/core/-/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      {
        "repositoryKey": "core",
        "branch": {
          "state": "detached",
          "name": null
        },
        "hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "availability": "local",
        "remoteVerifiedAt": null,
        "commitUrl": null
      },
      {
        "repositoryKey": "core",
        "branch": {
          "state": "unknown",
          "name": null
        },
        "hash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "availability": "unknown",
        "remoteVerifiedAt": null,
        "commitUrl": null
      }
    ]
  }
}
```

Prompts continuam somente leitura: consultar escopo/evidências e indicar lacunas não grava declaração, não faz commit/push e não preenche legado.
