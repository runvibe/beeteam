# Proposta de próximos ícones na interface

Análise de apresentação do frontend atual. Estas substituições adicionais são propostas, não foram aplicadas.

| Tela / ação atual | Símbolo sugerido | Impacto e cuidado |
| --- | --- | --- |
| Detalhes: Voltar | ArrowLeft | Reduz repetição; manter nome acessível e tooltip com destino contextual. |
| Seletores e listas de histórico: Anterior / Próxima | ChevronLeft / ChevronRight | Compacta paginação; preservar página atual, estado desabilitado e nomes específicos. |
| Planos: Histórico de alterações | History | Reduz peso da ação secundária; manter aria-expanded e tooltip. |
| Planos: Ver revisão N | Eye | Simplifica cada linha; número da revisão continua visível e no nome acessível. |
| Agentes: Abrir referência | ExternalLink | O símbolo já existe; pode substituir o rótulo mantendo identificação da referência e indicação de destino externo. |
| Falhas de consulta: Tentar novamente / Consultar novamente | RefreshCw | Ícone em ações compactas; mensagem de erro permanece textual. |
| Formulário em conflito: Recarregar formulário | RotateCcw + texto | Manter texto: pode descartar o rascunho e precisa de contexto claro. |
| Exportação: Baixar arquivo | Download | Pode ser só ícone junto ao nome/extensão do arquivo; preservar nome acessível. |
| Transferências: Exportar / Importar | Download / Upload + texto | Manter texto na operação principal: direções podem ser confundidas. |

Papéis e modos nos cards já usam coroa, pessoa, mão, raio e ajustes para distinguir líder, colaborador, manual, automático e padrão. Contagem usa número e pessoa, com tooltip singular/plural. Filtros, configurações globais, tema e navegação principal já são compactos.

Não converter títulos, nomes de entidades, descrições, resumos de trabalho, rótulos de campo, erros ou ações de salvar/restaurar/cancelar transferência em ícones isolados. Eles comunicam conteúdo ou consequência. Preferir preenchimento em símbolos de estado quando a silhueta continuar legível; setas e ações de navegação ficam mais claras com traço. Cada ação proposta exige tooltip por mouse/foco, nome acessível específico e alvo de toque adequado, sem depender apenas da cor.
