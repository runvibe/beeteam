import { useEffect } from "react";
import { create } from "zustand";
import { currentUrl, useLocation } from "@/routing/location";
import { useUi, type Area } from "./ui";

export type HiveArea = Exclude<Area, "home">;

type HiveNavigationState = {
  /** URL that the Hive destination reopens after visiting another section. */
  lastUrl: string;
  remember: (url: string) => void;
};

export const useHiveNavigation = create<HiveNavigationState>()((set) => ({
  lastUrl: "/boards",
  remember: (lastUrl) => set({ lastUrl }),
}));

export function isHiveArea(area: Area): area is HiveArea {
  return area !== "home";
}

export function lastHiveDestination() {
  return useHiveNavigation.getState().lastUrl;
}

export function useRememberHiveLocation() {
  const area = useUi((state) => state.area);
  const url = useLocation();
  useEffect(() => {
    if (isHiveArea(area)) useHiveNavigation.getState().remember(currentUrl());
  }, [area, url]);
}
