import { Hexagon } from "lucide-react";
import "./loading-indicator.css";

export function LoadingIndicator({
  label = "Carregando",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`bee-loading${compact ? " bee-loading-compact" : ""}`}
    >
      <Hexagon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
