import { AnimatePresence, motion } from "framer-motion";
import TransactionRow from "./TransactionRow.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Badge from "../ui/Badge.jsx";
import { formatDate, formatCurrency } from "../../utils/formatters.js";
import { Pencil } from "lucide-react";

function TransactionCard({ transaction, role, onEdit }) {
  const { date, amount, category, type, description } = transaction;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {formatDate(date)}
        </span>
        <Badge type={type} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {category}
          </p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[200px]">
              {description}
            </p>
          )}
        </div>
        <span
          className={`text-sm font-semibold ${type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {type === "expense" ? "-" : "+"}
          {formatCurrency(amount)}
        </span>
      </div>
      {role === "admin" && (
        <div className="flex justify-end">
          <button
            onClick={() => onEdit(transaction)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Edit transaction"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function TransactionTable({
  transactions,
  role,
  onEdit,
  scrollable = true,
  groupKey,
}) {
  if (!transactions || transactions.length === 0) {
    return <EmptyState message="No transactions found." />;
  }

  const colSpan = role === "admin" ? 5 : 4;

  return (
    <>
      {/* Desktop table (lg+) */}
      <div
        className={`hidden lg:flex flex-col ${scrollable ? "overflow-hidden" : ""}`}
      >
        <div
          className={
            scrollable ? "overflow-y-auto overflow-x-auto" : "overflow-x-auto"
          }
        >
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#0f1623] shadow-sm dark:shadow-none">
              {groupKey && (
                <tr className="bg-blue-50 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
                  <th
                    colSpan={colSpan}
                    className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest"
                  >
                    {groupKey}
                  </th>
                </tr>
              )}
              <tr className="border-b border-black/8 dark:border-white/10 text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-[#0f1623]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                {role === "admin" && (
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    role={role}
                    onEdit={onEdit}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile stacked cards (below lg) */}
      <div className="flex flex-col gap-3 lg:hidden p-3">
        {groupKey && (
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest px-1">
            {groupKey}
          </p>
        )}
        <AnimatePresence initial={false}>
          {transactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              role={role}
              onEdit={onEdit}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
