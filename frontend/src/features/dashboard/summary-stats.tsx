import { Link } from '@tanstack/react-router'
import { useResumen } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePeriodo } from '@/context/period-provider'
import { formatMinutes, formatPEN, formatTimestamp } from '@/lib/format'

function Stat({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-muted-foreground text-xs">{hint}</CardContent>}
    </Card>
  )
}

export function SummaryStats() {
  const { periodo } = usePeriodo()
  const { data, isLoading, isError, refetch } = useResumen(periodo)
  return (
    <BlockState
      isLoading={isLoading}
      isError={isError}
      onRetry={() => void refetch()}
      skeletonClassName="h-28 w-full"
    >
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Acumulado"
            value={formatPEN(data.total)}
            hint={`Movilidad ${formatPEN(data.costo_movilidad)} · Otros ${formatPEN(data.otros_gastos)}`}
          />
          <Stat
            label="Registros"
            value={String(data.registros)}
            hint={data.ultimo_registro_at ? `Último: ${formatTimestamp(data.ultimo_registro_at)}` : 'Sin registros'}
          />
          <Stat
            label="Por revisar"
            value={String(data.por_revisar)}
            hint={
              data.por_revisar > 0 && (
                <Link to="/registros" className="underline">
                  Ver registros
                </Link>
              )
            }
          />
          <Stat
            label="Horas extra"
            value={formatMinutes(data.horas_extra_minutos)}
            hint={data.horas_extra_monto === null ? 'Sin tarifa configurada' : formatPEN(data.horas_extra_monto)}
          />
        </div>
      )}
    </BlockState>
  )
}
