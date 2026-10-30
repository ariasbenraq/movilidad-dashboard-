import { formatMonthYear } from "./formatters.js";

/**
 * Apply all active filters to a transaction list.
 * Pipeline: search → type → category → dateRange
 * @param {Array} transactions
 * @param {Object} filters
 * @returns {Array}
 */
export function applyFilters(transactions, filters) {
  const { search, type, category, dateFrom, dateTo } = filters;
  let result = transactions;

  // Search: case-insensitive match on category or description
  if (search && search.trim() !== "") {
    const term = search.trim().toLowerCase();
    result = result.filter(
      (tx) =>
        tx.category.toLowerCase().includes(term) ||
        (tx.description && tx.description.toLowerCase().includes(term)),
    );
  }

  // Type filter
  if (type && type !== "all") {
    result = result.filter((tx) => tx.type === type);
  }

  // Category filter
  if (category && category !== "all") {
    result = result.filter((tx) => tx.category === category);
  }

  // Date range filter (inclusive, compare YYYY-MM-DD strings)
  if (dateFrom && dateFrom !== "") {
    result = result.filter((tx) => tx.date >= dateFrom);
  }
  if (dateTo && dateTo !== "") {
    result = result.filter((tx) => tx.date <= dateTo);
  }

  return result;
}

/**
 * Sort transactions by a given field and direction.
 * Does NOT mutate the input array.
 * @param {Array} transactions
 * @param {'date'|'amount'} sortField
 * @param {'asc'|'desc'} sortDir
 * @returns {Array}
 */
export function sortTransactions(transactions, sortField, sortDir) {
  return [...transactions].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // String comparison for dates, numeric for amounts
    let cmp;
    if (sortField === "date") {
      cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      cmp = aVal - bVal;
    }

    return sortDir === "asc" ? cmp : -cmp;
  });
}

/**
 * Group transactions by a given grouping key.
 * @param {Array} transactions
 * @param {'none'|'category'|'month'} groupBy
 * @returns {Object} map of group key → transactions array
 */
export function groupTransactions(transactions, groupBy) {
  if (!groupBy || groupBy === "none") {
    return { all: transactions };
  }

  const groups = {};

  for (const tx of transactions) {
    let key;
    if (groupBy === "category") {
      key = tx.category;
    } else if (groupBy === "month") {
      key = formatMonthYear(tx.date);
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  return groups;
}
