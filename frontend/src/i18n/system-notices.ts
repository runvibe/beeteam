import { t } from "./index";
// Exact backend-owned notice templates, never a general text translation table.
export const demoResumeNotice =
  "Contexto demonstrativo. Não inicia chats nem confirma atividade ao vivo.";
const storedResumeNotice =
  "Stored context only; no session is started or monitored.";
export function resumeNotice(value: string) {
  if (value === demoResumeNotice) return t("agents.demoResumeNotice");
  if (value === storedResumeNotice) return t("agents.storedResumeNotice");
  return value;
}
