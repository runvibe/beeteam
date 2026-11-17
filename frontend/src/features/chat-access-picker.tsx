import {
  Check,
  ChevronDown,
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileCog,
} from "lucide-react";
import { Popover, RadioGroup } from "radix-ui";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import {
  accessModes,
  isAccessMode,
  useChatAccess,
  useChatAccessSettings,
} from "@/state/chat-access";
import { accessLabel, confirmAccess } from "./chat-access-labels";
import "./chat-access-picker.css";

const icons = {
  read_only: Shield,
  standard: ShieldCheck,
  full_access: ShieldAlert,
  codex_config: FileCog,
};

export function ChatAccessPicker({
  chatId,
  disabled = false,
}: {
  chatId: string;
  disabled?: boolean;
}) {
  useLocale();
  const mode = useChatAccess((s) => s.byChat[chatId] ?? s.defaultMode);
  const choose = useChatAccess((s) => s.choose);
  const openSettings = useChatAccessSettings((s) => s.setOpen);
  const Icon = icons[mode];
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="chat-access-trigger"
          disabled={disabled}
          aria-label={t("chat.accessCurrent", { mode: accessLabel(mode) })}
        >
          <Icon aria-hidden="true" /> {accessLabel(mode)}{" "}
          <ChevronDown aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="chat-access-popover"
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          aria-label={t("chat.accessTitle")}
        >
          <strong>{t("chat.accessTitle")}</strong>
          <RadioGroup.Root
            value={mode}
            aria-label={t("chat.accessTitle")}
            onValueChange={(next) => {
              if (isAccessMode(next) && next !== mode && confirmAccess(next)) {
                choose(chatId, next);
              }
            }}
          >
            {accessModes.map((item) => {
              const OptionIcon = icons[item];
              return (
                <RadioGroup.Item
                  key={item}
                  value={item}
                  className="chat-access-option"
                >
                  <OptionIcon aria-hidden="true" />
                  <span>
                    <strong>{accessLabel(item)}</strong>
                    <small>{t(`chat.accessDescription_${item}`)}</small>
                  </span>
                  <RadioGroup.Indicator>
                    <Check aria-hidden="true" />
                  </RadioGroup.Indicator>
                </RadioGroup.Item>
              );
            })}
          </RadioGroup.Root>
          <Popover.Close asChild>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => openSettings(true)}
            >
              {t("chat.accessSetDefault")}
            </Button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
