import { ConnectedApp } from "./connected-app";
import { ApiProvider } from "@/api/context";
import { ApiVersionGate } from "@/components/api-version-gate";
import type { BeeApi } from "@/api/types";
import type { ChangeSource } from "@/api/live-refresh";
import { appVersion } from "@/app-version";


export function LaunchRoot({
  api,
  changes,
}: {
  api: BeeApi;
  changes?: ChangeSource;
}) {
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
