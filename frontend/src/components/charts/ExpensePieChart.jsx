import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { formatCurrency } from "../../utils/formatters";
import EmptyState from "../ui/EmptyState";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  const pct = payload[0].payload._pct;
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f1623]/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{name}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {formatCurrency(value)}
      </p>
      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
        {pct}% of expenses
      </p>
    </div>
  );
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.06) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function ExpensePieChart({ data }) {
  if (!data || data.length === 0) {
    return <EmptyState message="No expense data to display" />;
  }

  const total = data.reduce((s, d) => s + d.total, 0);
  const enriched = data.map((d) => ({
    ...d,
    _pct: ((d.total / total) * 100).toFixed(1),
  }));

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.2 }}
      className="flex flex-col h-full"
    >
      {/* Chart — takes available space */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              dataKey="total"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius="50%"
              paddingAngle={3}
              labelLine={false}
              label={<CustomLabel />}
            >
              {enriched.map((entry, index) => (
                <Cell
                  key={`cell-${entry.category}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="shrink-0 grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-black/8 dark:border-white/5">
        {enriched.map((entry, index) => (
          <div key={entry.category} className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 h-3 w-3 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {entry.category}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-auto shrink-0">
              {entry._pct}%
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
