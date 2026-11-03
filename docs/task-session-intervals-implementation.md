# Implementação: intervalos de consumo por tarefa

Referência: [especificação](task-session-intervals-spec.md). Autorização de implementação: 2026-11-03.

## Entregas e verificações

- [ ] Backend: contrato HTTP/MCP comum, persistência relacional por driver e transições atômicas com resumos.
- [ ] Integridade: exclusividade por fonte, idempotência, pausas, resets, intervalos incompletos e reconciliação auditável.
- [ ] Consultas: recuperação do intervalo aberto, listagem paginada e agregados sem dupla contagem.
- [ ] Frontend: apresentação separada de acumulados da sessão e consumo/duração dos intervalos.
- [ ] Skills: fronteiras explícitas, recuperação e exemplos validados contra o contrato final.
- [ ] Integração: testes focados HTTP/MCP e interface, builds e revisão de toda a alteração.
- [ ] Publicação na branch de integração, preservando runtime e dados locais.

## Limites de execução

Implementações usam os worktrees existentes das equipes. O checkout principal integra commits revisados; serviços ativos não são reiniciados para validar empacotamento. Testes não usam o banco do produto. A dispensa anterior de PostgreSQL foi específica da entrega anterior; esta alteração de persistência deve validar ambos os drivers em ambiente isolado quando disponível e informar qualquer limitação.

## Registro de decisões

- O fluxo existente de resumo e seus dados históricos permanecem compatíveis. Nenhuma fronteira é inferida por texto ou horário.
- A API e as skills devem convergir no mesmo formato antes da instalação final das instruções.
- Encerrar um intervalo não conclui automaticamente a tarefa; status e resultado da execução continuam distintos.

## Evidências

Preencher com os commits e verificações reais na integração. Este documento não declara que a funcionalidade já foi entregue.
