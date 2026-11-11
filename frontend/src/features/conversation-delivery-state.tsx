import { useQuery } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import { t as tr, useLocale } from "@/i18n";
import type { SessionDelivery } from "@/api/generated/kanban/SessionDelivery";

export function ConversationDeliveryState({
  taskId,
  commentId,
}: {
  taskId: string;
  commentId: string;
}) {
  useLocale();
  const api = useApi();
  const query = useQuery({
    queryKey: ["session-deliveries", taskId, commentId],
    queryFn: ({ signal }) => api.sessionDeliveries(taskId, commentId, signal),
    refetchInterval: (query) =>
      query.state.data?.items.some((row) =>
        ["managed", "managed_backpressure", "pending", "dispatching", "acknowledged", "waiting_binding"].includes(
          row.state,
        ),
      )
        ? 2500
        : false,
  });
  if (!query.data?.items.length) return null;
  return (
    <ul className="conversation-delivery-state" aria-live="polite">
      {query.data.items.map((row) => (
        <Delivery key={row.id} row={row} />
      ))}
    </ul>
  );
}
function Delivery({ row }: { row: SessionDelivery }) {
  const recipient = useEntity("agents", row.targetAgentId);
  return (
    <li>
      <span>{recipient.data?.name ?? tr("common.agents")}</span>
      {": "}
      {tr(`tasks.deliveryState_${row.state}`)}
    </li>
  );
}
