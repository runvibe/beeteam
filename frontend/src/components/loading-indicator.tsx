import { Hexagon } from "lucide-react";
import { useEffect, useState } from "react";
import "./loading-indicator.css";

export function LoadingIndicator({
  label = "Carregando",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
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
      <Hexagon
        aria-hidden="true"
        style={{ visibility: visible ? "visible" : "hidden" }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
