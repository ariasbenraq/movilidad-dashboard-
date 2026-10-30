const styles = {
  income: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  expense: "bg-red-500/15 text-red-400 border border-red-500/30",
};

export default function Badge({ type }) {
  const label = type === "income" ? "Income" : "Expense";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] ?? styles.expense}`}
    >
      {label}
    </span>
  );
}
