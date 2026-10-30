/**
 * Format a number as INR currency string.
 * @param {number} amount
 * @returns {string} e.g. '₹1,234.56'
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a YYYY-MM-DD date string to a human-readable date.
 * @param {string} dateStr - e.g. '2024-10-15'
 * @returns {string} e.g. 'Oct 15, 2024'
 */
export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a YYYY-MM-DD date string to short month + 2-digit year.
 * @param {string} dateStr - e.g. '2024-10-15'
 * @returns {string} e.g. 'Oct 24'
 */
export function formatMonthYear(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const shortMonth = date.toLocaleDateString("en-US", { month: "short" });
  const shortYear = String(year).slice(-2);
  return `${shortMonth} ${shortYear}`;
}

/**
 * Format a number as a percentage string.
 * @param {number} value
 * @returns {string} e.g. '12.5%'
 */
export function formatPercent(value) {
  return `${value}%`;
}
