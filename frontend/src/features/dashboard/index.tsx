import { Main } from '@/components/layout/main'
import { AccumulatedChart } from './accumulated-chart'
import { MonthProgress } from './month-progress'
import { ProjectionCard } from './projection-card'
import { SummaryStats } from './summary-stats'

export function DashboardPage() {
  return (
    <Main title="Resumen">
      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectionCard />
        <MonthProgress />
      </div>
      <SummaryStats />
      <AccumulatedChart />
    </Main>
  )
}
