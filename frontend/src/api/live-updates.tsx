import { useLocale, t as tr } from "@/i18n";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  startLiveRefresh,
  type ChangeSource,
  type LiveStatus,
} from "./live-refresh";
export function LiveUpdates({ source }: { source: ChangeSource }) {
  useLocale();
  const client = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  useEffect(
    () =>
      startLiveRefresh({
        source,
        status: setStatus,
        document,
        refresh: async () => {
          // Discard requests started before this event, including initial loads.
          // Their responses may represent a snapshot taken before the commit.
          const local = {
            predicate: (query: { meta?: Record<string, unknown> }) =>
              query.meta?.scope !== "public",
          };
          await client.cancelQueries(local);
          await client.invalidateQueries({ ...local, refetchType: "active" });
        },
      }),
    [source, client],
  );
  return status === "reconnecting" ? (
    <p role="status" className="small-note px-4 py-2">
      {tr(
        "errors.liveUpdatesInterruptedReconnectingPollingEvery15SecondsWhileThe",
      )}
    </p>
  ) : null;
}
