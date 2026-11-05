import { ConnectedApp } from "./connected-app";
import { ApiProvider } from "@/api/context";
import { ApiVersionGate } from "@/components/api-version-gate";
import type { BeeApi } from "@/api/types";
import type { ChangeSource } from "@/api/live-refresh";
import { appVersion } from "@/app-version";

import { useLocation } from "@/routing/location";
import { Landing } from "./landing";

export function LaunchRoot({
  api,
  changes,
}: {
  api: BeeApi;
  changes?: ChangeSource;
}) {
  const url = useLocation();
  if (url.split("?")[0] === "/") return <Landing />;
  return (
    <ApiProvider api={api} key="real">
      <ApiVersionGate
        expectedVersion={appVersion}
        changes={changes}
      >
        <ConnectedApp />
      </ApiVersionGate>
    </ApiProvider>
  );
}
