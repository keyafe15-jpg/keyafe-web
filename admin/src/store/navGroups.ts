import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NavGroupsState {
  /** Labels of the sidebar sections that are open; any other section is folded. */
  open: string[];
  /** Section of the last page visited, so a reload doesn't reopen a section the user folded. */
  lastVisited: string | null;
  toggle: (label: string) => void;
  /** Opens the section of the current page when the user moves into it. */
  visit: (label: string) => void;
}

export const useNavGroups = create<NavGroupsState>()(
  persist(
    (set) => ({
      open: ["Overview"],
      lastVisited: null,
      toggle: (label) =>
        set((s) => ({
          open: s.open.includes(label) ? s.open.filter((l) => l !== label) : [...s.open, label],
        })),
      visit: (label) =>
        set((s) =>
          s.lastVisited === label
            ? s
            : {
                lastVisited: label,
                open: s.open.includes(label) ? s.open : [...s.open, label],
              },
        ),
    }),
    { name: "keyafe-admin-nav-groups" },
  ),
);
