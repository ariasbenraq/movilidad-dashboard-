import { Sun, Moon } from "lucide-react";
import useFinanceStore from "../../store/useFinanceStore";

export default function ThemeToggle() {
  const theme = useFinanceStore((s) => s.theme);
  const toggleTheme = useFinanceStore((s) => s.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="p-2 rounded-lg border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#111827] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
