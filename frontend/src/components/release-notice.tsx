import { t, useLocale } from "@/i18n";
import { usePublicManifest } from "@/launch/public-manifest";
import { newerStableRelease } from "@/api/version-policy";

export function ReleaseNotice({
  installedVersion,
}: {
  installedVersion: string;
}) {
  useLocale();
  const query = usePublicManifest();
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
