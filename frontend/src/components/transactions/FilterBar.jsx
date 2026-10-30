import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, Search, X } from "lucide-react";
import CustomSelect from "../ui/CustomSelect.jsx";
import CustomDatePicker from "../ui/CustomDatePicker.jsx";

export default function FilterBar({ filters, categories, onChange, onReset }) {
  const [open, setOpen] = useState(false);

  const {
    search = "",
    type = "all",
    category = "all",
    dateFrom = "",
    dateTo = "",
    sortField = "date",
    sortDir = "desc",
    groupBy = "none",
  } = filters;

  const hasActiveFilters =
    search !== "" ||
    type !== "all" ||
    category !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortField !== "date" ||
    sortDir !== "desc" ||
    groupBy !== "none";

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#111827] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";
  const labelClass = "block text-xs text-gray-600 dark:text-gray-400 mb-1";

  const typeOptions = [
    { value: "all", label: "All types" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
  ];

  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  const sortOptions = [
    { value: "date", label: "Date" },
    { value: "amount", label: "Amount" },
  ];

  const groupOptions = [
    { value: "none", label: "None" },
    { value: "category", label: "Category" },
    { value: "month", label: "Month" },
  ];

  const controls = (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-2 items-end">
      {/* Search — wider on smaller screens */}
      <div className="col-span-2 md:col-span-3 lg:col-span-2">
        <label className={labelClass}>Search</label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Category or description…"
            value={search}
            onChange={(e) => onChange({ search: e.target.value })}
            className={`${inputClass} pl-8`}
          />
        </div>
      </div>

      {/* Type */}
      <div className="col-span-1">
        <label className={labelClass}>Type</label>
        <CustomSelect
          value={type}
          onChange={(v) => onChange({ type: v })}
          options={typeOptions}
        />
      </div>

      {/* Category */}
      <div className="col-span-1">
        <label className={labelClass}>Category</label>
        <CustomSelect
          value={category}
          onChange={(v) => onChange({ category: v })}
          options={categoryOptions}
        />
      </div>

      {/* Date From */}
      <div className="col-span-1">
        <label className={labelClass}>From</label>
        <CustomDatePicker
          value={dateFrom}
          onChange={(v) => onChange({ dateFrom: v })}
          placeholder="From date"
        />
      </div>

      {/* Date To */}
      <div className="col-span-1">
        <label className={labelClass}>To</label>
        <CustomDatePicker
          value={dateTo}
          onChange={(v) => onChange({ dateTo: v })}
          placeholder="To date"
        />
      </div>

      {/* Sort */}
      <div className="col-span-1">
        <label className={labelClass}>Sort by</label>
        <CustomSelect
          value={sortField}
          onChange={(v) => onChange({ sortField: v })}
          options={sortOptions}
        />
      </div>

      {/* Group by + direction toggle */}
      <div className="col-span-1 flex gap-1 items-end">
        <div className="flex-1 min-w-0">
          <label className={labelClass}>Group by</label>
          <CustomSelect
            value={groupBy}
            onChange={(v) => onChange({ groupBy: v })}
            options={groupOptions}
          />
        </div>
        <button
          onClick={() =>
            onChange({ sortDir: sortDir === "asc" ? "desc" : "asc" })
          }
          className="shrink-0 self-end rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#111827] px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-blue-500/40 transition-colors text-sm"
          title={sortDir === "asc" ? "Ascending" : "Descending"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#0f1623] p-4">
      {/* Mobile/tablet toggle (below lg) */}
      <div className="flex items-center justify-between lg:hidden mb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X size={12} />
            Reset
          </button>
        )}
      </div>

      {/* Mobile/tablet collapsible panel (below lg) */}
      <div className="lg:hidden">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="filter-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-2">{controls}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop always-visible controls (lg+) */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Filter size={14} />
            <span>Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X size={12} />
              Reset
            </button>
          )}
        </div>
        {controls}
      </div>
    </div>
  );
}
