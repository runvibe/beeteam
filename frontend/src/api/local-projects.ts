/** HTTP-only local action; contract: docs/local-projects-openapi.json. */
export type ProjectApplication = "explorer" | "vscode";
export type OpenProjectResponse = {
  projectKey: string;
  application: ProjectApplication;
  outcome: "requested";
};
