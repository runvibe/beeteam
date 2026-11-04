import { useLocale, t as tr } from "@/i18n";

import {
  Crown,
  UserRound,
  UserRoundMinus,
  ZapOff,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import { Tooltip } from "radix-ui";

const symbols = {
  leader: {
    icon: Crown,
    get label() {
      return tr("common.leader");
    },
  },
  collaborator: {
    icon: UserRound,
    get label() {
      return tr("common.collaborator");
    },
  },
  unbound: {
    icon: UserRoundMinus,
    get label() {
      return tr("common.noAssociation");
    },
  },
  manual: {
    icon: ZapOff,
    get label() {
      return tr("common.fullyManual");
    },
  },
  automatic: {
    icon: Zap,
    get label() {
      return tr("common.fullyAutomatic");
    },
  },
  standard: {
    icon: SlidersHorizontal,
    get label() {
      return tr("common.standard");
    },
  },
};
export function CardSymbol({
  kind,
  label: customLabel,
}: {
  kind: keyof typeof symbols;
  label?: string;
}) {
  useLocale();
  const { icon: Icon, label: defaultLabel } = symbols[kind];
  const label = customLabel || defaultLabel;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            role="img"
            aria-label={label}
            className="card-symbol"
          >
            <Icon
              aria-hidden="true"
              fill={
                kind === "standard" || kind === "unbound"
                  ? "none"
                  : "currentColor"
              }
            />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
