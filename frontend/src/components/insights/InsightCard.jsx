import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function InsightCard({ icon: Icon, label, value, description }) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl p-5 bg-white dark:bg-[#0f1623] border border-black/8 dark:border-white/10 hover:border-blue-500/30 transition-all duration-200 hover:shadow-[0_0_20px_rgba(59,130,246,0.12)]"
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 flex-shrink-0">
            <Icon size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
