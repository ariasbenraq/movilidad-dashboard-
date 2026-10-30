import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  BarChart2,
  Repeat,
  PiggyBank,
  Zap,
  Scale,
  CalendarCheck,
} from "lucide-react";
import { computeInsights } from "../../utils/calculations.js";
import { formatCurrency } from "../../utils/formatters.js";
import InsightCard from "./InsightCard.jsx";
import EmptyState from "../ui/EmptyState.jsx";

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function countExpenseMonths(transactions) {
  const months = new Set();
  for (const tx of transactions) {
    if (tx.type === "expense") months.add(tx.date.slice(0, 7));
  }
  return months.size;
}

export default function InsightsPanel({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return <EmptyState message="No data available for insights." />;
  }

  const insights = computeInsights(transactions);
  const expenseMonthCount = countExpenseMonths(transactions);
  const hasMoM = expenseMonthCount >= 2;

  // Month-over-month
  let momIcon = Minus;
  let momValue = "Insufficient data";
  let momDescription = "Need at least 2 months of expense data.";
  if (hasMoM && insights.momChange !== null) {
    const dir = insights.momDirection;
    momIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
    const changeStr = formatCurrency(insights.momChange);
    momValue =
      dir === "up"
        ? `+${changeStr}`
        : dir === "down"
          ? `-${changeStr}`
          : "No change";
    momDescription =
      dir === "up"
        ? "Expenses rose compared to last month."
        : dir === "down"
          ? "Expenses fell compared to last month."
          : "Expenses unchanged vs. last month.";
  }

  // Savings rate
  const savingsRate = insights.savingsRate;
  const savingsValue = savingsRate !== null ? `${savingsRate}%` : "—";
  const savingsDescription =
    savingsRate === null
      ? "No income data available."
      : savingsRate >= 20
        ? "Great job — you're saving well."
        : savingsRate > 0
          ? "Try to save at least 20% of income."
          : "Expenses exceed income this period.";

  // Biggest expense
  const biggestExpense = insights.biggestExpense;
  const biggestValue = biggestExpense
    ? formatCurrency(biggestExpense.amount)
    : "—";
  const biggestDescription = biggestExpense
    ? `${biggestExpense.category} — largest single expense.`
    : "No expense transactions found.";

  // Income/expense ratio
  const ratio = insights.incomeExpenseRatio;
  const ratioValue = ratio !== null ? `${ratio}x` : "—";
  const ratioDescription =
    ratio === null
      ? "No expense data available."
      : ratio >= 1
        ? `You earn ${ratio}x what you spend.`
        : "Spending exceeds income — review your budget.";

  const cards = [
    {
      icon: Tag,
      label: "Top Spending Category",
      value: insights.topCategory ?? "—",
      description: insights.topCategory
        ? "Category with the highest total expenses."
        : "No expense transactions found.",
    },
    {
      icon: momIcon,
      label: "Month-over-Month",
      value: momValue,
      description: momDescription,
    },
    {
      icon: BarChart2,
      label: "Avg Monthly Expense",
      value:
        insights.avgMonthlyExpense > 0
          ? formatCurrency(insights.avgMonthlyExpense)
          : "—",
      description: "Average expenses per month across all data.",
    },
    {
      icon: Repeat,
      label: "Most Frequent Category",
      value: insights.mostFrequentCategory ?? "—",
      description: insights.mostFrequentCategory
        ? "Category you transact in most often."
        : "No transactions found.",
    },
    {
      icon: PiggyBank,
      label: "Savings Rate",
      value: savingsValue,
      description: savingsDescription,
    },
    {
      icon: Zap,
      label: "Biggest Single Expense",
      value: biggestValue,
      description: biggestDescription,
    },
    {
      icon: Scale,
      label: "Income / Expense Ratio",
      value: ratioValue,
      description: ratioDescription,
    },
    {
      icon: CalendarCheck,
      label: "Most Active Month",
      value: insights.mostActiveMonth ?? "—",
      description: insights.mostActiveMonth
        ? `${insights.mostActiveMonthCount} transactions recorded.`
        : "No transaction data.",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {cards.map((card) => (
        <InsightCard
          key={card.label}
          icon={card.icon}
          label={card.label}
          value={card.value}
          description={card.description}
        />
      ))}
    </motion.div>
  );
}
