import { create } from "zustand";
export type Area = "boards" | "agents" | "teams";
interface UiState {
  area: Area;
  boardId: string | null;
  taskId: string | null;
  agentId: string | null;
  teamId: string | null;
  search: string;
  setArea: (area: Area) => void;
  openBoard: (id: string) => void;
  openTask: (id: string | null) => void;
  openAgent: (id: string | null) => void;
  openTeam: (id: string | null) => void;
  setSearch: (value: string) => void;
}
/** Navigation/client preferences only; server records belong to the API/query cache. */
export const useUi = create<UiState>((set) => ({
  area: "boards",
  boardId: null,
  taskId: null,
  agentId: null,
  teamId: null,
  search: "",
  setArea: (area) => set({ area, search: "", boardId: null }),
  openBoard: (boardId) => set({ area: "boards", boardId, search: "" }),
  openTask: (taskId) => set({ taskId }),
  openAgent: (agentId) => set({ agentId }),
  openTeam: (teamId) => set({ teamId }),
  setSearch: (search) => set({ search }),
}));
