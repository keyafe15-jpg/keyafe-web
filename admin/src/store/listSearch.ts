import { create } from "zustand";

/**
 * Shared query for the admin TopBar search.
 * List pages that support search read `query` and filter/API-search with it.
 * TopBar clears the query when the route changes.
 */
interface ListSearchState {
  query: string;
  setQuery: (query: string) => void;
  clear: () => void;
}

export const useListSearch = create<ListSearchState>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  clear: () => set({ query: "" }),
}));
