import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpLeft } from "lucide-react";
import { useLocale, t as tr } from "@/i18n";
import { useLocation } from "@/routing/location";
import {
  isDetailsView,
  openDetails,
  closeDetails,
} from "@/routing/details-view";
import { HeaderFilters } from "@/components/header-filters";
import { Button } from "@/components/ui/button";
import { DetailShell } from "@/components/detail-layout/detail-shell";
import { DetailHeader } from "@/components/detail-layout/detail-header";
import { DetailContext } from "@/components/detail-layout/detail-context";
import { DetailInfoButton } from "@/components/detail-layout/detail-info-button";
import { useDetailMobile } from "@/components/detail-layout/use-detail-mobile";
/** Routing adapter: the shared layout receives slots, never an entity or API client. */
export function EntityDetailPage({
  label,
  title,
  description,
  viewKey,
  contextLabel,
  backLabel,
  avatar,
  context,
  children,
  overlays,
}: {
  label: string;
  title: string;
  description: ReactNode;
  viewKey: string;
  contextLabel: string;
  backLabel: string;
  avatar?: ReactNode;
  context?: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
}) {
  useLocale();
  const heading = useRef<HTMLHeadingElement>(null);
  const mobile = useDetailMobile(),
    url = useLocation();
  const screen = mobile && isDetailsView(url, viewKey) && !!context;
  useEffect(() => {
    if (!screen) heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="detail-page entity-page" aria-label={label}>
      <DetailShell
        primaryHidden={screen}
        hero={
          <DetailHeader
            title={title}
            titleRef={heading}
            avatar={avatar}
            description={description}
          />
        }
        context={
          context && (
            <DetailContext
              label={contextLabel}
              screenTitle={contextLabel}
              screen={screen}
              mobile={mobile}
              backAction={
                <Button
                  variant="ghost"
                  aria-label={backLabel}
                  onClick={() => closeDetails(viewKey)}
                >
                  <ArrowUpLeft />
                  {tr("common.back")}
                </Button>
              }
            >
              {context}
            </DetailContext>
          )
        }
        overlays={
          <>
            {context && (
              <HeaderFilters enabled>
                <DetailInfoButton
                  label={contextLabel}
                  screen={screen}
                  mobile={mobile}
                  onOpen={() => openDetails(viewKey)}
                />
              </HeaderFilters>
            )}
            {overlays}
          </>
        }
      >
        {children}
      </DetailShell>
    </section>
  );
}
