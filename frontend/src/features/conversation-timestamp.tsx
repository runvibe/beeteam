import { useLocale, t as tr } from "@/i18n";

import { Popover, Tooltip } from "radix-ui";
import { RelativeTime } from "@/components/relative-time";
import { formatDate } from "@/components/shared";

export function ConversationTimestamp({ value }: { value: string }) {
  useLocale();
  const exact = formatDate(value);
  return (
    <Tooltip.Provider>
      <Popover.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="conversation-timestamp"
                aria-label={tr("tasks.messageTimestamp", { date: exact })}
              >
                <RelativeTime value={value} />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="navigation-tooltip" sideOffset={6}>
              {exact}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Content
            className="navigation-tooltip"
            sideOffset={6}
            align="end"
            aria-label={tr("common.messageDateAndTime")}
          >
            {exact}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Tooltip.Provider>
  );
}
