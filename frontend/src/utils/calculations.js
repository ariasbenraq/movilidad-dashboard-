import { formatMonthYear } from "./formatters.js";

/**
 * Compute summary totals from a list of transactions.
 * @param {Array} transactions
 * @returns {{ balance: number, income: number, expenses: number }}
 */
export function computeSummary(transactions) {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else if (tx.type === "expense") expenses += tx.amount;
  }
  return { balance: income - expenses, income, expenses };
}

/**
 * Compute cumulative monthly balance trend.
 * @param {Array} transactions
 * @returns {Array<{ month: string, balance: number }>} sorted chronologically
 */
export function computeMonthlyBalance(transactions) {
  // Group net (income - expense) by YYYY-MM key
  const netByMonth = {};
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7); // 'YYYY-MM'
    if (!netByMonth[key]) netByMonth[key] = 0;
    netByMonth[key] += tx.type === "income" ? tx.amount : -tx.amount;
  }

  // Sort keys chronologically
  const sortedKeys = Object.keys(netByMonth).sort();

  // Build cumulative balance entries
  let cumulative = 0;
  return sortedKeys.map((key) => {
    cumulative += netByMonth[key];
    // Use the first day of the month to format the label
    const label = formatMonthYear(`${key}-01`);
    return { month: label, balance: cumulative };
  });
}

/**
 * Compute total expenses grouped by category, sorted descending by total.
 * @param {Array} transactions
 * @returns {Array<{ category: string, total: number }>}
 */
export function computeExpensesByCategory(transactions) {
  const totals = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!totals[tx.category]) totals[tx.category] = 0;
    totals[tx.category] += tx.amount;
  }
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Compute financial insights from transactions.
 * @param {Array} transactions
 * @returns {{
 *   topCategory: string|null,
 *   momChange: number|null,
 *   momDirection: 'up'|'down'|'same'|null,
 *   avgMonthlyExpense: number,
 *   mostFrequentCategory: string|null
 * }}
 */
export function computeInsights(transactions) {
  // topCategory: category with highest total expenses
  const expensesByCategory = computeExpensesByCategory(transactions);
  const topCategory =
    expensesByCategory.length > 0 ? expensesByCategory[0].category : null;

  // Monthly expenses by YYYY-MM key
  const expensesByMonth = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = tx.date.slice(0, 7);
    if (!expensesByMonth[key]) expensesByMonth[key] = 0;
    expensesByMonth[key] += tx.amount;
  }

  const sortedMonths = Object.keys(expensesByMonth).sort();

  // momChange and momDirection
  let momChange = null;
  let momDirection = null;
  if (sortedMonths.length >= 2) {
    const lastMonth = expensesByMonth[sortedMonths[sortedMonths.length - 1]];
    const prevMonth = expensesByMonth[sortedMonths[sortedMonths.length - 2]];
    momChange = Math.abs(lastMonth - prevMonth);
    if (lastMonth > prevMonth) momDirection = "up";
    else if (lastMonth < prevMonth) momDirection = "down";
    else momDirection = "same";
  }

  // avgMonthlyExpense
  let avgMonthlyExpense = 0;
  if (sortedMonths.length > 0) {
    const totalExpenses = sortedMonths.reduce(
      (sum, key) => sum + expensesByMonth[key],
      0,
    );
    avgMonthlyExpense = totalExpenses / sortedMonths.length;
  }

  // mostFrequentCategory: category appearing most times across all transactions
  const categoryCount = {};
  for (const tx of transactions) {
    if (!categoryCount[tx.category]) categoryCount[tx.category] = 0;
    categoryCount[tx.category]++;
  }
  let mostFrequentCategory = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categoryCount)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentCategory = cat;
    }
  }

  // savingsRate: (income - expenses) / income * 100
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const tx of transactions) {
    if (tx.type === "income") totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  }
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
      : null;

  // biggestExpense: single transaction with highest amount
  const expenseTxs = transactions.filter((tx) => tx.type === "expense");
  const biggestExpense =
    expenseTxs.length > 0
      ? expenseTxs.reduce(
          (max, tx) => (tx.amount > max.amount ? tx : max),
          expenseTxs[0],
        )
      : null;

  // incomeExpenseRatio: income / expenses
  const incomeExpenseRatio =
    totalExpenses > 0
      ? Math.round((totalIncome / totalExpenses) * 100) / 100
      : null;

  // mostActiveMonth: month with most transactions
  const txCountByMonth = {};
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    if (!txCountByMonth[key]) txCountByMonth[key] = 0;
    txCountByMonth[key]++;
  }
  let mostActiveMonth = null;
  let maxTxCount = 0;
  for (const [month, count] of Object.entries(txCountByMonth)) {
    if (count > maxTxCount) {
      maxTxCount = count;
      mostActiveMonth = month;
    }
  }
  // Format mostActiveMonth label
  if (mostActiveMonth) {
    const [y, m] = mostActiveMonth.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    mostActiveMonth = date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  return {
    topCategory,
    momChange,
    momDirection,
    avgMonthlyExpense,
    mostFrequentCategory,
    savingsRate,
    biggestExpense,
    incomeExpenseRatio,
    mostActiveMonth,
    mostActiveMonthCount: maxTxCount,
  };
}
