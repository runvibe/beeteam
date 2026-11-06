import { BeeTeamLogo } from "./bee-team-logo";
import { useLocale, t as tr } from "@/i18n";


import { useEffect, useState } from "react";
import "./loading-indicator.css";

export function LoadingIndicator({
  label = tr("common.loading2"),
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  useLocale();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);
  return (
    <span
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`bee-loading${compact ? " bee-loading-compact" : ""}`}
    >
      <BeeTeamLogo
        aria-hidden="true"
        style={{ visibility: visible ? "visible" : "hidden" }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
