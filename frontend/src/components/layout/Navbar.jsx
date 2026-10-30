import { Menu } from "lucide-react";
import RoleToggle from "./RoleToggle";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white dark:bg-[#0f1623] border-b border-black/8 dark:border-white/10 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        >
          <Menu size={20} />
        </button>
        <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          FinanceIQ
        </span>
      </div>
      <div className="flex items-center gap-3">
        <RoleToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
