import { createContext, useContext } from "react";

export type FilterChip = {
  id: string;
  label: string;
  params: Record<string, string>;
};

export type ListViewState = {
  search: string;
  filters: FilterChip[];
  groupBy: string;
  favorites: string[];
};

export type SavedFilter = {
  id: string;
  label: string;
  filters: FilterChip[];
};

export type ListViewContextValue = {
  state: ListViewState;
  setSearch: (value: string) => void;
  addFilter: (chip: FilterChip) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  setGroupBy: (value: string) => void;
  toggleFavorite: (name: string) => void;
  applySavedFilter: (saved: SavedFilter) => void;
  savedFilters: SavedFilter[];
};

const ListViewContext = createContext<ListViewContextValue | null>(null);

export function useListView() {
  const ctx = useContext(ListViewContext);
  if (!ctx) {
    throw new Error("useListView must be used within ListViewContext");
  }
  return ctx;
}

export default ListViewContext;
