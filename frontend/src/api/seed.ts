import { fixtureSlugs } from "./mock-slugs";
import type { Resources } from "./types";
export const uuid = (n: number) =>
  `019a23a0-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
export const ids = {
  board: uuid(10),
  team: uuid(20),
  agent: uuid(30),
  task: uuid(100),
};
const date = "2026-10-27T12:30:00Z";
const lifecycle = {
  createdAt: date,
  updatedAt: date,
  archivedAt: null,
  deletedAt: null,
  version: 1,
};
const author = {
  actorKind: "agent" as const,
  actorId: ids.agent,
  createdAt: date,
  deletedAt: null,
};
export type Database = { [K in keyof Resources]: Resources[K][] };
export function makeSeed(): Database {
  const boards: Resources["boards"][] = [
    {
      id: ids.board,
      name: "Lançamento do produto",
      description:
        "Da descoberta à entrega. Acompanhe decisões, progresso e próximos passos do time.",
      teamId: ids.team,
      autonomyMode: "standard",
      createdBy: { actorKind: "human", actorId: null },
      lastManagementChange: null,
      ...lifecycle,
    },
    {
      id: uuid(11),
      name: "Pesquisa & estratégia",
      description: "Evidências para orientar os próximos ciclos.",
      teamId: uuid(21),
      autonomyMode: "manual",
      createdBy: { actorKind: "agent", actorId: uuid(33) },
      lastManagementChange: null,
      ...lifecycle,
    },
  ];
  const teams: Omit<Resources["teams"], "slug">[] = [
    {
      id: ids.team,
      name: "Produto & engenharia",
      purpose: "Transformar necessidades em software confiável.",
      context: "Ciclos curtos, decisões documentadas e revisão de entregas.",
      leaderId: uuid(31),
      workerCount: 2,
      ...lifecycle,
    },
    {
      id: uuid(21),
      name: "Pesquisa",
      purpose: "Investigar oportunidades e consolidar evidências.",
      context: "Priorizar fontes primárias e explicitar incertezas.",
      leaderId: uuid(33),
      workerCount: 1,
      ...lifecycle,
    },
  ];
  const agents: Omit<Resources["agents"], "slug">[] = [
    {
      id: ids.agent,
      name: "Lia",
      roleDescription: "Engenharia de produto",
      bindings: { workerTeamId: ids.team, leaderTeamId: null },
    },
    {
      id: uuid(31),
      name: "Theo",
      roleDescription: "Team leader · Produto & engenharia",
      bindings: { workerTeamId: null, leaderTeamId: ids.team },
    },
    {
      id: uuid(32),
      name: "Maya",
      roleDescription: "Design e experiência",
      bindings: { workerTeamId: ids.team, leaderTeamId: null },
    },
    {
      id: uuid(33),
      name: "Noah",
      roleDescription: "Team leader · Pesquisa",
      bindings: { workerTeamId: null, leaderTeamId: uuid(21) },
    },
    {
      id: uuid(34),
      name: "Eva",
      roleDescription: "Pesquisa de mercado",
      bindings: { workerTeamId: uuid(21), leaderTeamId: null },
    },
  ].map((a) => ({
    ...a,
    workStyle:
      "Trabalho incremental, comunicação objetiva e validação com evidências.",
    workInstructions:
      "Registrar o resultado e o próximo passo na tarefa ao encerrar uma atividade.",
    rules: [
      "Preservar decisões e contexto.",
      "Explicitar bloqueios antes de ampliar o escopo.",
    ],
    accessLimits: ["Usar somente recursos autorizados na conversa."],
    image: null,
    contextSummary: "",
    ...lifecycle,
  }));
  const statuses: Resources["statuses"][] = boards.flatMap((b, bi) =>
    ["Backlog", "A fazer", "Em andamento", "Em revisão", "Concluída"].map(
      (name, i) => ({
        id: uuid(50 + bi * 5 + i),
        boardId: b.id,
        name,
        isDone: i === 4,
        position: i,
        version: 1,
        archivedAt: null,
        deletedAt: null,
      }),
    ),
  );
  const titles = [
    "Mapear a jornada de primeiro uso",
    "Definir contratos da API",
    "Construir navegação dos boards",
    "Revisar acessibilidade dos formulários",
    "Consolidar aprendizados da descoberta",
    "Documentar erros da API",
    "Validar paginação da API",
    "Preparar critérios de aceite",
  ];
  const tasks: Omit<Resources["tasks"], "slug">[] = titles.map(
    (title, i) => ({
      id: uuid(100 + i),
      boardId: ids.board,
      authorAgentId: uuid(31),
      parentId: null,
      title,
      description:
        i === 0
          ? "Entender as etapas de entrada e identificar pontos de fricção.\n\nEntregável: mapa da jornada com oportunidades priorizadas."
          : "Registrar a solução, validar os critérios de aceite e documentar as decisões que orientam a entrega.",
      specification:
        i === 0
          ? '## Requisitos\n\n- Mapear a entrada e os pontos de fricção.\n- Preservar evidências das entrevistas.\n\n## Critérios de aceite\n\n| Entrega | Aceite |\n| --- | --- |\n| Mapa da jornada | Revisado pelo time |\n\nConsulte a [referência de Markdown](https://commonmark.org/).\n\n```json\n{ "entrega": "mapa-da-jornada", "aceite": "Etapas e oportunidades revisadas pelo time, com evidências e prioridade registradas." }\n```'
          : "",
      currentSummary:
        i === 0
          ? "Jornada inicial mapeada. Agora validando pontos de fricção. Pendente: priorizar oportunidades com o time."
          : i === 2
            ? "Estrutura dos boards pronta. Agora revisando os nomes de navegação. Pendente: confirmar nomenclatura e concluir os testes."
            : "",
      executorAgentId: i % 2 === 0 ? ids.agent : uuid(32),
      statusId: uuid(50 + (i % 5)),
      position: String(i).padStart(4, "0"),
      progress: {
        percent: [0, 15, 55, 90, 100][i % 5],
        note: "Último progresso registrado pelo Worker.",
      },
      block:
        i === 2
          ? {
              blocked: true,
              reason: "Aguardando definição dos nomes de navegação.",
            }
          : { blocked: false, reason: null },
      childSummary: { total: i === 0 ? 2 : 0, done: i === 0 ? 1 : 0 },
      latestExecutionSummaryId: i === 0 ? uuid(400) : null,
      autonomyMode: "manual",
      executionContext: {
        rootTaskId: uuid(100 + i),
        originBoardId: ids.board,
        originBoardMode: "standard",
        effectiveMode: "manual",
      },
      ...lifecycle,
    }),
  );
  tasks.push(
    ...[0, 1].map((i) => ({
      ...tasks[0],
      specification: "",
      currentSummary: "",
      id: uuid(120 + i),
      parentId: ids.task,
      executionContext: {
        rootTaskId: ids.task,
        originBoardId: ids.board,
        originBoardMode: "standard" as const,
        effectiveMode: "manual" as const,
      },
      title: [
        "Inventariar pontos de entrada",
        "Descrever hipóteses da jornada",
      ][i],
      statusId: uuid(i === 0 ? 54 : 52),
      childSummary: { total: 0, done: 0 },
      progress: { percent: i === 0 ? 100 : 50, note: "" },
    })),
  );
  tasks.push({
    ...tasks[0],
    specification: "",
    currentSummary: "",
    id: uuid(130),
    boardId: uuid(11),
    statusId: uuid(57),
    title: "Comparar referências de mercado",
    executorAgentId: uuid(34),
    childSummary: { total: 0, done: 0 },
  });
  tasks.push({
    ...tasks[0],
    specification: "",
    currentSummary: "",
    id: uuid(131),
    parentId: uuid(121),
    boardId: uuid(11),
    statusId: uuid(57),
    executorAgentId: uuid(34),
    title: "Validar hipóteses com pesquisa",
    childSummary: { total: 0, done: 0 },
    executionContext: {
      rootTaskId: ids.task,
      originBoardId: ids.board,
      originBoardMode: "standard",
      effectiveMode: "manual",
    },
  });
  tasks.push({
    ...tasks[0],
    specification: "",
    currentSummary: "",
    id: uuid(132),
    parentId: uuid(131),
    boardId: uuid(11),
    statusId: uuid(56),
    executorAgentId: uuid(34),
    title: "Conferir evidências das entrevistas",
    childSummary: { total: 0, done: 0 },
    executionContext: {
      rootTaskId: ids.task,
      originBoardId: ids.board,
      originBoardMode: "standard",
      effectiveMode: "manual",
    },
  });
  tasks.push({
    ...tasks[0],
    specification: "",
    currentSummary: "",
    id: uuid(140),
    title: "API removida logicamente",
    deletedAt: date,
  });
  const plans: Resources["plans"][] = [
    {
      id: uuid(300),
      planId: uuid(310),
      taskId: ids.task,
      title: "Plano de descoberta",
      revision: 2,
      content:
        "1. Inventariar os pontos de entrada.\n2. Organizar hipóteses por etapa.\n3. Revisar o mapa com o team leader.",
      changeSummary: "Incluída revisão dos pontos de entrada.",
      ...author,
    },
    {
      id: uuid(301),
      planId: uuid(310),
      taskId: ids.task,
      title: "Plano de descoberta",
      revision: 1,
      content: "1. Organizar hipóteses.\n2. Revisar o mapa.",
      changeSummary: null,
      ...author,
    },
  ];
  const comments: Resources["comments"][] = [
    {
      id: uuid(350),
      taskId: ids.task,
      body: "Priorizar o caminho de um board vazio. As decisões de escopo permanecem na conversa com o líder.",
      ...author,
    },
  ];
  const summaries: Resources["summaries"][] = [
    {
      id: uuid(400),
      taskId: ids.task,
      summary:
        "Pontos de entrada inventariados. O principal risco é apresentar dados antigos como atividade atual.",
      outcome: "progress",
      statusId: uuid(50),
      deliverables: [
        { label: "Notas da descoberta", attachmentId: uuid(450) },
      ],
      pending: [
        "Validar hipóteses com o líder.",
        "Consolidar mapa da jornada.",
      ],
      reviewContext: null,
      executionContext: { rootTaskId: ids.task, originBoardId: ids.board },
      ...author,
    },
  ];
  const attachments: Resources["attachments"][] = [
    {
      id: uuid(450),
      taskId: ids.task,
      originalName: "notas-da-descoberta.txt",
      mediaType: "text/plain",
      sizeBytes: 98,
      description: "Registro demonstrativo dos pontos de entrada.",
      ...author,
    },
  ];
  const timeline: Resources["timeline"][] = [
    {
      id: uuid(500),
      taskId: ids.task,
      sequence: 1,
      type: "task.created",
      occurredAt: date,
      data: { title: tasks[0].title },
      deletedAt: null,
      actorId: uuid(31),
      actorKind: "agent",
    },
    {
      id: uuid(501),
      taskId: ids.task,
      sequence: 2,
      type: "execution.recorded",
      occurredAt: date,
      data: { executionSummaryId: uuid(400) },
      deletedAt: null,
      actorId: ids.agent,
      actorKind: "agent",
    },
  ];
  const chats: Resources["chats"][] = [
    {
      id: uuid(600),
      agentId: ids.agent,
      harness: "Codex",
      externalId: "demo-chat",
      url: null,
      label: "Descoberta do produto",
      createdByActorId: ids.agent,
      actorKind: "agent",
      ...lifecycle,
    },
  ];
  return {
    boards,
    teams: fixtureSlugs(teams, "team"),
    agents: fixtureSlugs(agents, "agent"),
    statuses,
    tasks: fixtureSlugs(tasks, "task"),
    plans,
    comments,
    summaries,
    attachments,
    timeline,
    chats,
    members: [],
    activities: [],
  };
}
