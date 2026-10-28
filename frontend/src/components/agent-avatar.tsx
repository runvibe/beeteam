import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Agent } from "@/api/types";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { safeUrl } from "./shared";
export function AgentAvatar({ agent }: { agent: Agent }) {
  const image =
    agent.image?.kind === "external" ? safeUrl(agent.image.url) : undefined;
  return (
    <Avatar className="size-12">
      {agent.image?.kind === "upload" ? (
        <UploadedAvatarImage agent={agent} />
      ) : (
        <AvatarImage src={image} alt="" />
      )}
      <AvatarFallback>{agent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
function UploadedAvatarImage({ agent }: { agent: Agent }) {
  const api = useApi();
  const query = useQuery({
    queryKey: ["agent-image", agent.id, agent.version],
    queryFn: () => api.image(agent.id),
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  return <AvatarImage src={url} alt="" />;
}
