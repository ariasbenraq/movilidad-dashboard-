import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePeriodo } from '@/context/period-provider'

// The month is chosen by the user; the backend decides what the default month is.
export function PeriodPicker() {
  const { periodo, setPeriodo } = usePeriodo()
  return (
    <div className="flex items-center gap-1">
      <Input
        type="month"
        aria-label="Periodo"
        className="h-8 w-40"
        value={periodo ?? ''}
        onChange={(event) => setPeriodo(event.target.value || undefined)}
      />
      {periodo && (
        <Button variant="ghost" size="sm" onClick={() => setPeriodo(undefined)}>
          Mes actual
        </Button>
      )}
    </div>
  )
}
