import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useResumen } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { usePeriodo } from '@/context/period-provider'
import {
  clampPeriodo,
  joinPeriodo,
  MIN_PERIODO,
  monthName,
  shiftPeriodo,
  splitPeriodo,
  yearOptions,
} from '@/lib/period'

const selectClass =
  'border-input bg-background h-8 rounded-md border px-2 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50'

// Native <select>s on purpose: <input type="month"> has no picker in Firefox.
// The latest month is the backend's default period, learned from its own response.
export function PeriodPicker() {
  const { periodo, setPeriodo } = usePeriodo()
  const { data } = useResumen(undefined)
  const latest = data?.periodo
  const current = periodo ?? latest

  if (!latest || !current) return <div className="bg-muted h-8 w-52 animate-pulse rounded-md" aria-hidden />

  const { year, month } = splitPeriodo(current)
  const select = (next: string) => setPeriodo(clampPeriodo(next, latest))

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Mes anterior"
        disabled={current <= MIN_PERIODO}
        onClick={() => select(shiftPeriodo(current, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <select
        aria-label="Mes"
        className={selectClass}
        value={month}
        onChange={(event) => select(joinPeriodo(year, Number(event.target.value)))}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {monthName(m)}
          </option>
        ))}
      </select>
      <select
        aria-label="Año"
        className={selectClass}
        value={year}
        onChange={(event) => select(joinPeriodo(Number(event.target.value), month))}
      >
        {yearOptions(latest).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Mes siguiente"
        disabled={current >= latest}
        onClick={() => select(shiftPeriodo(current, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      {periodo && periodo !== latest && (
        <Button variant="ghost" size="icon" className="size-8" aria-label="Mes actual" onClick={() => setPeriodo(undefined)}>
          <RotateCcw className="size-4" />
        </Button>
      )}
    </div>
  )
}
