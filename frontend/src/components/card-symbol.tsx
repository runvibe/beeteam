import {
  Crown,
  UserRound,
  UserRoundMinus,
  Hand,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import { Tooltip } from "radix-ui";

const symbols = {
  leader: { icon: Crown, label: "Líder" },
  collaborator: { icon: UserRound, label: "Colaborador" },
  unbound: { icon: UserRoundMinus, label: "Sem vínculo" },
  manual: { icon: Hand, label: "Totalmente manual" },
  automatic: { icon: Zap, label: "Totalmente automático" },
  standard: { icon: SlidersHorizontal, label: "Padrão" },
};
export function CardSymbol({
  kind,
  label: customLabel,
}: {
  kind: keyof typeof symbols;
  label?: string;
}) {
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
