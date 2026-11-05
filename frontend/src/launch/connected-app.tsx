import { useLayoutEffect } from "react";
import App from "@/App";
import { navigate, useLocation } from "@/routing/location";
export function ConnectedApp() {
  const route = useLocation();
  const root = route.split("?")[0] === "/";
  useLayoutEffect(() => {
    if (!root) return;
    const next = new URL(route, location.origin);
    next.pathname = "/home";
    navigate(next.pathname + next.search, true);
  }, [route, root]);
  return root ? null : <App homeEnabled />;
}
