import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import type { components } from "@/api/generated/managed-agents";

type ToolProfile = components["schemas"]["ToolProfile"];

export function ManagedAgentConfigurationFields({
  search,
  network,
  mcps,
  skills,
  disabled,
  onSearch,
  onNetwork,
  onMcps,
  onSkills,
}: {
  search: ToolProfile["webSearch"];
  network: boolean;
  mcps: string;
  skills: string;
  disabled: boolean;
  onSearch: (value: ToolProfile["webSearch"]) => void;
  onNetwork: (value: boolean) => void;
  onMcps: (value: string) => void;
  onSkills: (value: string) => void;
}) {
  return (
    <>
      <label>
        {t("managed.search")}
        <select
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "live" || value === "cached" || value === "disabled")
              onSearch(value);
          }}
          disabled={disabled}
        >
          {(["live", "cached", "disabled"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`managed.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="assistant-check">
        <input
          type="checkbox"
          checked={network}
          onChange={(event) => onNetwork(event.target.checked)}
          disabled={disabled}
        />
        {t("managed.network")}
      </label>
      <label>
        {t("managed.mcps")}
        <Textarea
          value={mcps}
          onChange={(event) => onMcps(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        {t("managed.skills")}
        <Textarea
          value={skills}
          onChange={(event) => onSkills(event.target.value)}
          disabled={disabled}
        />
      </label>
    </>
  );
}
