import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  startLiveRefresh,
  type ChangeSource,
  type LiveStatus,
} from "./live-refresh";
export function LiveUpdates({ source }: { source: ChangeSource }) {
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
          await client.cancelQueries();
          await client.invalidateQueries({ refetchType: "active" });
        },
      }),
    [source, client],
  );
  return status === "reconnecting" ? (
    <p role="status" className="small-note px-4 py-2">
      Atualização ao vivo interrompida. Tentando reconectar; consulta a cada 15
      segundos enquanto a página estiver visível.
    </p>
  ) : null;
}
