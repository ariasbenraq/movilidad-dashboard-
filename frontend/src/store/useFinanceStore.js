import { create } from "zustand";
import { mockTransactions } from "../data/mockTransactions";

const DEFAULT_FILTERS = {
  search: "",
  type: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
  sortField: "date",
  sortDir: "desc",
  groupBy: "none",
};

const useFinanceStore = create((set) => ({
  transactions: mockTransactions,
  filters: DEFAULT_FILTERS,
  role: "viewer",
  theme: "dark",

  addTransaction: (t) =>
    set((s) => ({
      transactions: [...s.transactions, { ...t, id: crypto.randomUUID() }],
    })),

  updateTransaction: (id, patch) =>
    set((s) => ({
      transactions: s.transactions.map((tx) =>
        tx.id === id ? { ...tx, ...patch } : tx,
      ),
    })),

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setRole: (r) => set({ role: r }),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

export default useFinanceStore;
