import { Columns3, Network, Users } from "lucide-react";
import { useLocale, t } from "@/i18n";
import { useUi } from "@/state/ui";
import type { HiveArea } from "@/state/hive-navigation";
import { navigationHref } from "@/routing/location";
import "./hive-navigation.css";

const sections: readonly { area: HiveArea; label: () => string; Icon: typeof Columns3 }[] = [
  { area: "boards", label: () => t("common.boards"), Icon: Columns3 },
  { area: "agents", label: () => t("common.agents"), Icon: Users },
  { area: "teams", label: () => t("common.teams"), Icon: Network },
];

export function HiveNavigation() {
  useLocale();
  const area = useUi((state) => state.area);
  const setArea = useUi((state) => state.setArea);
  return (
    <nav className="hive-navigation" aria-label={t("common.hiveNavigation")}>
      <div className="hive-navigation-list">
        {sections.map(({ area: target, label, Icon }) => {
          const name = label();
          return (
            <a
              key={target}
              className="hive-navigation-link"
              href={navigationHref(`/${target}`)}
              aria-current={area === target ? "page" : undefined}
              aria-label={name}
              title={name}
              onClick={(event) => {
                if (
                  event.button ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                setArea(target);
              }}
            >
              <Icon aria-hidden="true" />
              <span>{name}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
