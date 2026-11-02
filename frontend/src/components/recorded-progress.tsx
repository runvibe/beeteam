import "./recorded-progress.css";
export function recordedPercent(percent?: number | null) {
  return typeof percent === "number" && Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : undefined;
}
export function RecordedProgress({
  percent,
  label,
  className = "",
}: {
  percent?: number | null;
  label: string;
  className?: string;
}) {
  const value = recordedPercent(percent);
  return (
    <div
      className={`recorded-progress-track ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={value === undefined ? "Sem dados" : undefined}
      data-empty={value === undefined}
    >
      {value !== undefined && (
        <div
          className="recorded-progress-fill"
          style={{ width: `${value}%` }}
        />
      )}
    </div>
  );
}
