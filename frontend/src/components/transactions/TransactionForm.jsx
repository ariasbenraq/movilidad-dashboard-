import { useState } from "react";
import { X } from "lucide-react";

const CATEGORIES = [
  "Food",
  "Rent",
  "Salary",
  "Entertainment",
  "Transport",
  "Healthcare",
  "Freelance",
  "Utilities",
];

function validate(fields) {
  const errors = {};

  if (!fields.date || fields.date.trim() === "") {
    errors.date = "Date is required.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) {
    errors.date = "Date must be a valid ISO date (YYYY-MM-DD).";
  } else {
    const d = new Date(fields.date);
    if (isNaN(d.getTime())) errors.date = "Date is not valid.";
  }

  if (fields.amount === "" || fields.amount === undefined) {
    errors.amount = "Amount is required.";
  } else {
    const num = Number(fields.amount);
    if (isNaN(num) || num <= 0) {
      errors.amount = "Amount must be a positive number greater than 0.";
    }
  }

  if (!fields.category || fields.category === "") {
    errors.category = "Category is required.";
  } else if (!CATEGORIES.includes(fields.category)) {
    errors.category = "Please select a valid category.";
  }

  if (!fields.type || (fields.type !== "income" && fields.type !== "expense")) {
    errors.type = "Type must be income or expense.";
  }

  if (fields.description && fields.description.length > 100) {
    errors.description = "Description must be 100 characters or fewer.";
  }

  return errors;
}

export default function TransactionForm({ initial, onSubmit, onClose }) {
  const isEdit = Boolean(initial);

  const [fields, setFields] = useState({
    date: initial?.date ?? "",
    amount: initial?.amount ?? "",
    category: initial?.category ?? "",
    type: initial?.type ?? "expense",
    description: initial?.description ?? "",
  });

  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({
      ...fields,
      amount: Number(fields.amount),
    });
  }

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";
  const selectClass =
    "w-full rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";
  const labelClass = "block text-sm text-gray-700 dark:text-gray-300 mb-1";
  const errorClass = "mt-1 text-xs text-red-500 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Date */}
      <div>
        <label className={labelClass} htmlFor="tf-date">
          Date <span className="text-red-400">*</span>
        </label>
        <input
          id="tf-date"
          type="date"
          name="date"
          value={fields.date}
          onChange={handleChange}
          className={`${inputClass} [color-scheme:dark] ${errors.date ? "border-red-500/60" : ""}`}
        />
        {errors.date && <p className={errorClass}>{errors.date}</p>}
      </div>

      {/* Amount */}
      <div>
        <label className={labelClass} htmlFor="tf-amount">
          Amount <span className="text-red-400">*</span>
        </label>
        <input
          id="tf-amount"
          type="number"
          name="amount"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={fields.amount}
          onChange={handleChange}
          className={`${inputClass} ${errors.amount ? "border-red-500/60" : ""}`}
        />
        {errors.amount && <p className={errorClass}>{errors.amount}</p>}
      </div>

      {/* Category */}
      <div>
        <label className={labelClass} htmlFor="tf-category">
          Category <span className="text-red-400">*</span>
        </label>
        <select
          id="tf-category"
          name="category"
          value={fields.category}
          onChange={handleChange}
          className={`${selectClass} ${errors.category ? "border-red-500/60" : ""}`}
        >
          <option value="">Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.category && <p className={errorClass}>{errors.category}</p>}
      </div>

      {/* Type */}
      <div>
        <label className={labelClass} htmlFor="tf-type">
          Type <span className="text-red-400">*</span>
        </label>
        <select
          id="tf-type"
          name="type"
          value={fields.type}
          onChange={handleChange}
          className={`${selectClass} ${errors.type ? "border-red-500/60" : ""}`}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        {errors.type && <p className={errorClass}>{errors.type}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass} htmlFor="tf-description">
          Description{" "}
          <span className="text-gray-500 text-xs">
            (optional, max 100 chars)
          </span>
        </label>
        <input
          id="tf-description"
          type="text"
          name="description"
          maxLength={100}
          placeholder="Optional note…"
          value={fields.description}
          onChange={handleChange}
          className={`${inputClass} ${errors.description ? "border-red-500/60" : ""}`}
        />
        {errors.description && (
          <p className={errorClass}>{errors.description}</p>
        )}
        <p className="mt-1 text-right text-xs text-gray-500">
          {fields.description.length}/100
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          {isEdit ? "Save Changes" : "Add Transaction"}
        </button>
      </div>
    </form>
  );
}
