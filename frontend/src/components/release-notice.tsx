import { useQuery } from "@tanstack/react-query";
import { t, useLocale } from "@/i18n";
import { parseInstallManifest } from "@/api/install-manifest";
import { newerStableRelease } from "@/api/version-policy";

export function ReleaseNotice({
  installedVersion,
}: {
  installedVersion: string;
}) {
  useLocale();
  const query = useQuery({
    queryKey: ["public-install-manifest"],
    meta: { scope: "public" },
    queryFn: async ({ signal }) => {
      const timeout = AbortSignal.timeout(5000);
      const response = await fetch(
        import.meta.env.VITE_INSTALL_MANIFEST_URL ||
          "https://getbee.team/install.json",
        { signal: AbortSignal.any([signal, timeout]), credentials: "omit" },
      );
      if (!response.ok) throw new Error("install_manifest_unavailable");
      return parseInstallManifest(await response.json());
    },
    retry: false,
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
  if (
    !query.data ||
    !newerStableRelease(installedVersion, query.data.appVersion)
  )
    return null;
  return (
    <aside className="release-notice" aria-label={t("common.optionalUpdate")}>
      <p>
        {t("common.optionalUpdateAvailable", {
          version: query.data.appVersion,
        })}
      </p>
      <details>
        <summary>{t("common.updateDownloads")}</summary>
        <p>{t("common.setupUpdateGuidance")}</p>
        <ul>
          {query.data.artifacts.map((artifact) => (
            <li key={`${artifact.os}/${artifact.arch}`}>
              <a href={artifact.url} target="_blank" rel="noopener noreferrer">
                {artifact.os} · {artifact.arch} · {artifact.fileName}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
