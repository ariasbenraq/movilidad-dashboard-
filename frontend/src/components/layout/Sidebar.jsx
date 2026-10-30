import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Lightbulb, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/insights", label: "Insights", icon: Lightbulb },
];

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
         ${
           isActive
             ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
             : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border border-transparent"
         }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

// Persistent sidebar for lg+
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 bg-white dark:bg-[#0f1623] border-r border-black/8 dark:border-white/10 h-screen overflow-y-auto transition-colors duration-300">
      <nav className="flex flex-col gap-1 p-4 pt-6">
        {navLinks.map((link) => (
          <NavItem key={link.to} {...link} />
        ))}
      </nav>
    </aside>
  );
}

// Overlay drawer for mobile
function MobileSidebar({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed top-0 left-0 z-50 flex flex-col w-56 h-full bg-white dark:bg-[#0f1623] border-r border-black/8 dark:border-white/10 lg:hidden"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-black/8 dark:border-white/10">
              <span className="text-base font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                FinanceIQ
              </span>
              <button
                onClick={onClose}
                aria-label="Close sidebar"
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <NavItem key={link.to} {...link} onClick={onClose} />
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar isOpen={isOpen} onClose={onClose} />
    </>
  );
}
