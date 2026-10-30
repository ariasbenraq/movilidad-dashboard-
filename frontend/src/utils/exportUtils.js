/**
 * Trigger a browser file download with the given content.
 * @param {string} content - file content
 * @param {string} filename - download filename
 * @param {string} mimeType - MIME type
 */
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export transactions as a CSV file and trigger browser download.
 * Header: id,date,amount,category,type,description
 * @param {Array} transactions
 * @param {string} [filename='transactions.csv']
 */
export function exportCSV(transactions, filename = "transactions.csv") {
  const header = "id,date,amount,category,type,description";
  const rows = transactions.map((tx) => {
    const description = tx.description
      ? `"${tx.description.replace(/"/g, '""')}"`
      : "";
    return `${tx.id},${tx.date},${tx.amount},${tx.category},${tx.type},${description}`;
  });
  const csv = [header, ...rows].join("\n");
  triggerDownload(csv, filename, "text/csv;charset=utf-8;");
}

/**
 * Export transactions as a JSON file and trigger browser download.
 * @param {Array} transactions
 * @param {string} [filename='transactions.json']
 */
export function exportJSON(transactions, filename = "transactions.json") {
  const json = JSON.stringify(transactions, null, 2);
  triggerDownload(json, filename, "application/json");
}
