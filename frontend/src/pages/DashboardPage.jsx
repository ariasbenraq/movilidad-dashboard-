import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import useFinanceStore from "../store/useFinanceStore";
import {
  computeSummary,
  computeMonthlyBalance,
  computeExpensesByCategory,
} from "../utils/calculations";
import { formatCurrency, formatDate } from "../utils/formatters";
import SummaryCard from "../components/ui/SummaryCard";
import BalanceTrendChart from "../components/charts/BalanceTrendChart";
import ExpensePieChart from "../components/charts/ExpensePieChart";

const staggerContainer = { visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function RecentTransactions({ transactions }) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-400">
          Recent Transactions
        </h2>
        <Link
          to="/transactions"
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-gray-500 py-2 text-center">
          No transactions yet
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {recent.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-1.5 border-b border-black/5 dark:border-white/5 last:border-0"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {tx.category}
                </span>
                {tx.description && (
                  <span className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    {tx.description}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-600">
                  {formatDate(tx.date)}
                </span>
              </div>
              <span
                className={`text-sm font-semibold shrink-0 ml-3 ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {tx.type === "income" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const { balance, income, expenses } = computeSummary(transactions);
  const monthlyBalance = computeMonthlyBalance(transactions);
  const expensesByCategory = computeExpensesByCategory(transactions);

  return (
    <div className="flex flex-col p-3 sm:p-4 gap-3">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <SummaryCard
          label="Total Balance"
          value={balance}
          icon={Wallet}
          formatter={formatCurrency}
        />
        <SummaryCard
          label="Total Income"
          value={income}
          icon={TrendingUp}
          formatter={formatCurrency}
        />
        <SummaryCard
          label="Total Expenses"
          value={expenses}
          icon={TrendingDown}
          formatter={formatCurrency}
        />
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col xl:flex-row gap-3"
      >
        <div className="flex flex-col gap-3 xl:flex-1">
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] p-4 flex flex-col"
          >
            <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-400 shrink-0">
              Balance Trend
            </h2>
            <div className="h-[220px]">
              <BalanceTrendChart data={monthlyBalance} />
            </div>
          </motion.div>
          <RecentTransactions transactions={transactions} />
        </div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] p-4 flex flex-col xl:w-[42%] xl:shrink-0 xl:self-stretch"
        >
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-400 shrink-0">
            Expenses by Category
          </h2>
          <div className="h-[320px] xl:flex-1 xl:h-auto xl:min-h-[320px]">
            <ExpensePieChart data={expensesByCategory} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
