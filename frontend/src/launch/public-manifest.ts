import { useQuery } from "@tanstack/react-query";
import { parseInstallManifest } from "@/api/install-manifest";
export function usePublicManifest() {
  return useQuery({
    queryKey: ["public-install-manifest"],
    meta: { scope: "public" },
    queryFn: async ({ signal }) => {
      const response = await fetch(
        import.meta.env.VITE_INSTALL_MANIFEST_URL ||
          "https://getbee.team/install.json",
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          credentials: "omit",
        },
      );
      if (!response.ok) throw new Error("install_manifest_unavailable");
      return parseInstallManifest(await response.json());
    },
    retry: false,
    staleTime: 300000,
    refetchInterval: 300000,
  });
}
