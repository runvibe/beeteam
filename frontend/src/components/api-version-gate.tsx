import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { apiInfoKey, parseApiInfo } from "@/api/compatibility";
import { assessApiVersion } from "@/api/version-policy";
import { LiveUpdates } from "@/api/live-updates";
import type { ChangeSource } from "@/api/live-refresh";
import { t, useLocale } from "@/i18n";
import { Button } from "./ui/button";
import "./api-version-gate.css";
import { ReleaseNotice } from "./release-notice";
import { navigate } from "@/routing/location";

export function ApiVersionGate({
  expectedVersion,
  children,
  changes,
  renderBlocked,
  introduction = false,
}: {
  expectedVersion: string;
  children: ReactNode;
  changes?: ChangeSource;
  renderBlocked?: (connection: ReactNode) => ReactNode;
  introduction?: boolean;
}) {
  useLocale();
  const api = useApi();
  const query = useQuery({
    queryKey: apiInfoKey,
    networkMode: "always",
    queryFn: async ({ signal }) => parseApiInfo(await api.info(signal)),
    retry: false,
    refetchInterval: (state) =>
      state.state.error
        ? Math.min(
            30_000,
              3_000 * 2 ** Math.min(Math.max(0, state.state.errorUpdateCount - 1), 4),
          )
        : 15_000,
    refetchOnWindowFocus: true,
  });
  const agreement = query.data
    ? assessApiVersion(expectedVersion, query.data)
    : undefined;
  if (!introduction && !query.error && agreement === "compatible")
    return (
      <>
        <ReleaseNotice installedVersion={expectedVersion} />
        {changes && <LiveUpdates source={changes} />}
        {children}
      </>
    );
  const checking = !query.data && query.isPending;
  const message =
    !query.error && agreement === "compatible"
      ? t("common.connectionReady")
      : checking
        ? t("common.connectionChecking")
        : query.error
          ? t("common.connectionUnavailable")
          : agreement === "api-older"
            ? t("common.localUpdateRequired")
            : agreement === "frontend-older"
              ? t("common.frontendUpdateRequired")
              : t("common.versionAgreementRequired");
  const Container = renderBlocked ? "section" : "main";
  const Heading = renderBlocked ? "h2" : "h1";
  const connection = (
    <Container className="api-version-gate">
      <section className="api-version-card" aria-labelledby="connection-title">
        <Heading id="connection-title">{t("common.connectGetBeeTeam")}</Heading>
        <p role="status">{message}</p>
        {query.data && (
          <p>
            {t("common.versionPair", {
              frontend: expectedVersion,
              api: query.data.apiVersion,
            })}
          </p>
        )}
        {query.error != null && <p>{t("common.connectionGuidance")}</p>}
        <div className="api-version-actions">
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("common.checkConnectionAgain")}
          </Button>
          {agreement === "compatible" && !query.error && (
            <Button onClick={() => navigate("/?demo=0")}>
              {t("common.launchOpenPanel")}
            </Button>
          )}
          {agreement === "frontend-older" && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t("common.reloadFrontend")}
            </Button>
          )}
        </div>
      </section>
    </Container>
  );
  return renderBlocked ? renderBlocked(connection) : connection;
}
