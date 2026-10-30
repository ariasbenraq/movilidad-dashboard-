import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import Badge from "../ui/Badge.jsx";
import { formatDate, formatCurrency } from "../../utils/formatters.js";

export default function TransactionRow({ transaction, role, onEdit }) {
  const { date, amount, category, type, description } = transaction;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group border-b border-black/5 dark:border-white/5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/5"
    >
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {formatDate(date)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
        <div className="font-medium">{category}</div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[180px] mt-0.5">
            {description}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge type={type} />
      </td>
      <td
        className={`px-4 py-3 text-sm font-semibold whitespace-nowrap text-right ${type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
      >
        {type === "expense" ? "-" : "+"}
        {formatCurrency(amount)}
      </td>
      {role === "admin" && (
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => onEdit(transaction)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Edit transaction"
          >
            <Pencil size={13} />
            Edit
          </button>
        </td>
      )}
    </motion.tr>
  );
}
