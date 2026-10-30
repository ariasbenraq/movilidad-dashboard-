import useFinanceStore from "../store/useFinanceStore";
import InsightsPanel from "../components/insights/InsightsPanel";

export default function InsightsPage() {
  const transactions = useFinanceStore((s) => s.transactions);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Insights
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Computed observations from your transaction data.
        </p>
      </div>
      <InsightsPanel transactions={transactions} />
    </div>
  );
}
