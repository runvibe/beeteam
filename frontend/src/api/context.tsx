import { createContext, useContext, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { BeeApi, Resources, Entities, Filters } from "./types";
const Context = createContext<BeeApi | null>(null);
export function ApiProvider({
  api,
  children,
}: {
  api: BeeApi;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 15000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <Context.Provider value={api}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Context.Provider>
  );
}
export function useApi() {
  const api = useContext(Context);
  if (!api) throw new Error("ApiProvider required");
  return api;
}
export function useList<K extends keyof Resources>(
  resource: K,
  scope = "",
  filters: Filters = {},
) {
  const api = useApi();
  return useQuery({
    queryKey: [resource, scope, filters],
    queryFn: () => api.list(resource, scope, filters),
  });
}
export function useEntity<K extends keyof Entities>(resource: K, id: string) {
  const api = useApi();
  return useQuery({
    queryKey: [resource, id],
    queryFn: () => api.get(resource, id),
    enabled: !!id,
  });
}
