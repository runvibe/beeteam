const catalog: Record<string, string> = {
  codex: "codex",
  "codex cli": "codex",
  "openai codex": "codex",
  "claude code": "claudecode",
  claudecode: "claudecode",
  cursor: "cursor",
  "github copilot": "githubcopilot",
  copilot: "githubcopilot",
  "gemini cli": "gemini",
  gemini: "gemini",
  windsurf: "windsurf",
  cline: "cline",
  kiro: "kiro",
  opencode: "opencode",
  "open code": "opencode",
};
export function harnessIcon(name: string) {
  const key = name.trim().toLocaleLowerCase();
  const icon = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  return icon ? `/harness-icons/${icon}.svg` : undefined;
}
export function canonicalHarness(name: string) {
  const key = name.trim().toLocaleLowerCase();
  const icon = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  const labels: Record<string, string> = {
    codex: "Codex",
    claudecode: "Claude Code",
    cursor: "Cursor",
    githubcopilot: "GitHub Copilot",
    gemini: "Gemini CLI",
    windsurf: "Windsurf",
    cline: "Cline",
    kiro: "Kiro",
    opencode: "OpenCode",
  };
  return icon ? labels[icon] : name.trim();
}
