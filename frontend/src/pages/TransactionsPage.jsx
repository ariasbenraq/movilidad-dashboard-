import { useState, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

import useFinanceStore from "../store/useFinanceStore.js";
import {
  applyFilters,
  sortTransactions,
  groupTransactions,
} from "../utils/filterUtils.js";

import FilterBar from "../components/transactions/FilterBar.jsx";
import ExportMenu from "../components/transactions/ExportMenu.jsx";
import TransactionTable from "../components/transactions/TransactionTable.jsx";
import TransactionForm from "../components/transactions/TransactionForm.jsx";
import Modal from "../components/ui/Modal.jsx";

const CATEGORIES = [
  "Food",
  "Rent",
  "Salary",
  "Entertainment",
  "Transport",
  "Healthcare",
  "Freelance",
  "Utilities",
];

const PAGE_SIZE = 10;

export default function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const filters = useFinanceStore((s) => s.filters);
  const role = useFinanceStore((s) => s.role);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const resetFilters = useFinanceStore((s) => s.resetFilters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => applyFilters(transactions, filters),
    [transactions, filters],
  );

  const sorted = useMemo(
    () => sortTransactions(filtered, filters.sortField, filters.sortDir),
    [filtered, filters.sortField, filters.sortDir],
  );

  // Reset to page 1 whenever filters/sort change
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage]);

  const grouped = useMemo(
    () => groupTransactions(paginated, filters.groupBy),
    [paginated, filters.groupBy],
  );

  const categories = useMemo(() => {
    const fromData = [...new Set(transactions.map((tx) => tx.category))].sort();
    return [...new Set([...CATEGORIES, ...fromData])].sort();
  }, [transactions]);

  function handleFilterChange(f) {
    setFilters(f);
    setPage(1);
  }

  function handleReset() {
    resetFilters();
    setPage(1);
  }

  function openAddModal() {
    setEditingTransaction(null);
    setIsModalOpen(true);
  }

  function openEditModal(transaction) {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingTransaction(null);
  }

  function handleFormSubmit(fields) {
    if (editingTransaction) {
      updateTransaction(editingTransaction.id, fields);
    } else {
      addTransaction(fields);
    }
    closeModal();
  }

  const exportList = sorted;

  // Page number buttons — show at most 5 around current page
  function getPageNumbers() {
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(1, safePage - delta);
      i <= Math.min(totalPages, safePage + delta);
      i++
    ) {
      range.push(i);
    }
    return range;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col lg:h-full"
    >
      {/* Header + filters */}
      <div className="flex-shrink-0 flex flex-col gap-6 p-4 sm:p-6 pb-4 border-b border-black/8 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Transactions
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {sorted.length} transaction{sorted.length !== 1 ? "s" : ""} found
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <ExportMenu transactions={exportList} />
            {role === "admin" && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Plus size={16} />
                Add Transaction
              </button>
            )}
          </div>
        </div>

        <FilterBar
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([groupKey, groupTxs]) => (
            <div key={groupKey} className="flex flex-col gap-3">
              <div className="rounded-xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] overflow-hidden">
                <TransactionTable
                  transactions={groupTxs}
                  role={role}
                  onEdit={openEditModal}
                  scrollable={filters.groupBy === "none"}
                  groupKey={filters.groupBy !== "none" ? groupKey : undefined}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 gap-3 flex-wrap">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
                    n === safePage
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
      >
        <TransactionForm
          initial={editingTransaction}
          onSubmit={handleFormSubmit}
          onClose={closeModal}
        />
      </Modal>
    </motion.div>
  );
}
