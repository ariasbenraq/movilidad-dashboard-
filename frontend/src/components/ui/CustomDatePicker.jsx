import { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatDisplay(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}) {
  const selected = parseDate(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openPicker() {
    const b = selected || today;
    setViewYear(b.getFullYear());
    setViewMonth(b.getMonth());
    setOpen(true);
  }
  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  function selectDay(day) {
    onChange(toISO(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }
  function clear(e) {
    e.stopPropagation();
    onChange("");
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) =>
    selected &&
    d &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === d;
  const isToday = (d) =>
    d &&
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === d;
  const isFuture = (d) => {
    if (!d) return false;
    const dt = new Date(viewYear, viewMonth, d);
    dt.setHours(0, 0, 0, 0);
    const tm = new Date(today);
    tm.setHours(0, 0, 0, 0);
    return dt > tm;
  };
  const isNextMonthFuture =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#111827] px-3 py-2 text-sm hover:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
      >
        <span
          className={
            value
              ? "text-gray-900 dark:text-white"
              : "text-gray-400 dark:text-gray-500"
          }
        >
          {value ? formatDisplay(value) : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={clear}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-0.5 rounded"
            >
              <X size={12} />
            </span>
          )}
          <CalendarDays size={14} className="text-gray-400" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1 w-64 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#111827] shadow-xl shadow-black/10 dark:shadow-black/50 p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                disabled={isNextMonthFuture}
                className={`p-1 rounded-lg transition-colors ${isNextMonthFuture ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" : "text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"}`}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs text-gray-400 dark:text-gray-500 font-medium py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => (
                <div key={i} className="flex items-center justify-center">
                  {day ? (
                    <button
                      onClick={() => !isFuture(day) && selectDay(day)}
                      disabled={isFuture(day)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors
                        ${
                          isFuture(day)
                            ? "text-gray-300 dark:text-gray-700 cursor-not-allowed"
                            : isSelected(day)
                              ? "bg-blue-500 text-white"
                              : isToday(day)
                                ? "border border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
                        }`}
                    >
                      {day}
                    </button>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-3 pt-2 border-t border-black/8 dark:border-white/10">
              <button
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onChange(toISO(today));
                  setOpen(false);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
