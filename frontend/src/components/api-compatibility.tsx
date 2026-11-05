import { useApiCompatibility } from "@/api/compatibility";
import { useLocale, t as tr } from "@/i18n";
import { ApiCompatibilityMessage } from "./api-compatibility-message";
import { Button } from "./ui/button";

export function ApiCompatibilityBanner() {
  const query = useApiCompatibility();
  return (
    <ApiCompatibilityMessage
      status={query.status}
      busy={query.isFetching}
      retry={() => void query.refetch()}
    />
  );
}

export function ApiCompatibilityDetails() {
  useLocale();
  const query = useApiCompatibility();
  return (
    <section className="detail-section" aria-label={tr("compatibility.title")}>
      <h3>{tr("compatibility.title")}</h3>
      <dl className="text-sm [overflow-wrap:anywhere]">
        <dt>{tr("compatibility.installedVersion")}</dt>
        <dd>{query.info?.apiVersion ?? tr("compatibility.unknown")}</dd>
        <dt>{tr("compatibility.contract")}</dt>
        <dd>
          {query.info?.supportedContractVersions.join(", ") ||
            tr("compatibility.unknown")}
        </dd>
        <dt>{tr("compatibility.capabilities")}</dt>
        <dd>
          {query.info
            ? query.info.capabilities.join(", ") || tr("compatibility.none")
            : tr("compatibility.unknown")}
        </dd>
      </dl>
      <p className="small-note" role="status">
        {tr(`compatibility.${query.status}`)}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={query.isFetching}
        onClick={() => {
          if (!query.isFetching) void query.refetch();
        }}
      >
        {tr("compatibility.retry")}
      </Button>
    </section>
  );
}
