import { Download } from "lucide-react";
import { exportCSV, exportJSON } from "../../utils/exportUtils.js";

const btnClass =
  "inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors";

export default function ExportMenu({ transactions }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => exportCSV(transactions)} className={btnClass}>
        <Download size={14} />
        Export CSV
      </button>
      <button onClick={() => exportJSON(transactions)} className={btnClass}>
        <Download size={14} />
        Export JSON
      </button>
    </div>
  );
}
