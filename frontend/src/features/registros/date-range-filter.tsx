import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface DateRange {
  desde: string
  hasta: string
}

interface Props {
  value: DateRange
  onChange: (value: DateRange) => void
  soloRevisar: boolean
  onSoloRevisarChange: (value: boolean) => void
}

export function DateRangeFilter({ value, onChange, soloRevisar, onSoloRevisarChange }: Props) {
  const active = value.desde !== '' || value.hasta !== ''
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" type="date" value={value.desde} max={value.hasta || undefined}
          onChange={(event) => onChange({ ...value, desde: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" type="date" value={value.hasta} min={value.desde || undefined}
          onChange={(event) => onChange({ ...value, hasta: event.target.value })} />
      </div>
      {active && (
        <Button variant="ghost" onClick={() => onChange({ desde: '', hasta: '' })}>
          Limpiar fechas
        </Button>
      )}
      <Button variant={soloRevisar ? 'default' : 'outline'} aria-pressed={soloRevisar}
        onClick={() => onSoloRevisarChange(!soloRevisar)}>
        Solo por revisar
      </Button>
    </div>
  )
}
