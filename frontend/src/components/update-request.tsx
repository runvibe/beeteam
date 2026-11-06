import { t } from "@/i18n";
import { CopyButton } from "./copy-button";

export function UpdateRequest() {
  const prompt = t("common.releaseUpdatePrompt");
  return (
    <div className="grid gap-3 justify-items-start">
      <p>{t("common.releaseCopyInstruction")}</p>
      <p className="rounded-md border p-3 text-sm select-text">{prompt}</p>
      <CopyButton text={prompt} label={t("common.releaseCopyAction")} />
    </div>
  );
}
