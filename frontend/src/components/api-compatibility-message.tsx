import { useLocale, t as tr } from "@/i18n";
import { Button } from "./ui/button";

import type { CompatibilityStatus } from "@/api/compatibility";

/** Presentation only: connection failures never imply an older release. */
export function ApiCompatibilityMessage({
  status,
  retry,
  busy,
}: {
  status: CompatibilityStatus;
  retry: () => void;
  busy: boolean;
}) {
  useLocale();
  if (status === "compatible" || status === "checking") return null;
  const messages = {
    incompatible: tr("compatibility.incompatible"),
    legacy: tr("compatibility.legacy"),
    error: tr("compatibility.error"),
  };
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <p className="min-w-0 flex-1">{messages[status]}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={busy}
        onClick={() => {
          if (!busy) retry();
        }}
      >
        {tr("compatibility.retry")}
      </Button>
    </div>
  );
}
