import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionSort } from "@/api/managed-agents";

export type SessionGroupKey = "team" | "board" | "agent";
export const SESSION_GROUP_KEYS: SessionGroupKey[] = ["team", "board", "agent"];
export const SESSION_GROUP_MAX_DEPTH = 3;
export const SESSION_FILTER_MAX_VALUES = 50;
export type SessionFilters = {
  teamIds: string[];
  boardIds: string[];
  agentIds: string[];
};
type SessionsSidebarState = {
  open: boolean;
  /** Drawer visibility on narrow screens; never persisted. */
  drawer: boolean;
  search: string;
  sort: SessionSort;
  groupBy: SessionGroupKey[];
  filters: SessionFilters;
  /** Narrow screens toggle the drawer; wide screens toggle the docked column. */
  toggle: (narrow: boolean) => void;
  setOpen: (open: boolean) => void;
  setDrawer: (drawer: boolean) => void;
  setSearch: (search: string) => void;
  setSort: (sort: SessionSort) => void;
  setGroupBy: (groupBy: SessionGroupKey[]) => void;
  toggleFilter: (kind: keyof SessionFilters, id: string) => void;
  clearFilters: () => void;
};
const emptyFilters: SessionFilters = { teamIds: [], boardIds: [], agentIds: [] };

export function normalizeGroupBy(groupBy: readonly unknown[]): SessionGroupKey[] {
  const keys = groupBy.filter(
    (key, index): key is SessionGroupKey =>
      SESSION_GROUP_KEYS.includes(key as SessionGroupKey) &&
      groupBy.indexOf(key) === index,
  );
  return keys.slice(0, SESSION_GROUP_MAX_DEPTH);
}

export const useSessionsSidebar = create<SessionsSidebarState>()(
  persist(
    (set) => ({
      open: true,
      drawer: false,
      search: "",
      sort: "updated_desc",
      groupBy: ["team"],
      filters: emptyFilters,
      toggle: (narrow) =>
        set((s) => (narrow ? { drawer: !s.drawer } : { open: !s.open })),
      setOpen: (open) => set({ open }),
      setDrawer: (drawer) => set({ drawer }),
      setSearch: (search) => set({ search }),
      setSort: (sort) => set({ sort }),
      setGroupBy: (groupBy) => set({ groupBy: normalizeGroupBy(groupBy) }),
      toggleFilter: (kind, id) =>
        set((s) => {
          const current = s.filters[kind];
          if (!current.includes(id) && current.length >= SESSION_FILTER_MAX_VALUES)
            return s;
          return {
            filters: {
              ...s.filters,
              [kind]: current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id],
            },
          };
        }),
      clearFilters: () => set({ filters: emptyFilters }),
    }),
    {
      name: "beeteam-sessions-sidebar",
      version: 1,
      partialize: ({ open, sort, groupBy, filters }) => ({
        open,
        sort,
        groupBy,
        filters,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionsSidebarState>;
        return {
          ...current,
          ...saved,
          groupBy: normalizeGroupBy(saved.groupBy ?? current.groupBy),
          filters: { ...emptyFilters, ...saved.filters },
        };
      },
    },
  ),
);
