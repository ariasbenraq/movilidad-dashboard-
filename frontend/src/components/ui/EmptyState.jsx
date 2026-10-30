import { Inbox } from "lucide-react";

export default function EmptyState({ message = "No data available" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-white/5 p-4">
        <Inbox size={28} className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
