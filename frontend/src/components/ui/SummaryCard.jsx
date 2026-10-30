import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function SummaryCard({
  label,
  value,
  icon: Icon,
  trend,
  formatter,
}) {
  const formatted = formatter ? formatter(value) : value;
  const isPositive = trend?.direction === "up";
  const isNegative = trend?.direction === "down";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02 }}
      className="relative rounded-2xl p-5 bg-white dark:bg-[#0f1623] border border-black/8 dark:border-white/10 hover:border-blue-500/30 transition-all duration-200 hover:shadow-[0_0_20px_rgba(59,130,246,0.12)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {formatted}
          </p>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-medium ${isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-gray-400"}`}
            >
              {isPositive && <TrendingUp size={12} />}
              {isNegative && <TrendingDown size={12} />}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 flex-shrink-0">
            <Icon size={20} className="text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
