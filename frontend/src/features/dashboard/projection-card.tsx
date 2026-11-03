import { useProyeccion } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePeriodo } from '@/context/period-provider'
import { formatDate, formatPEN } from '@/lib/format'

export function ProjectionCard() {
  const { periodo } = usePeriodo()
  const { data, isLoading, isError, refetch } = useProyeccion(periodo)
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {data?.cerrado ? 'Monto del mes cerrado' : 'Recibirás aproximadamente'}
        </CardDescription>
        <CardTitle className="text-4xl font-bold tabular-nums sm:text-5xl">
          {data ? formatPEN(data.proyectado) : '—'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BlockState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          skeletonClassName="h-12 w-full"
        >
          {data && (
            <div className="space-y-1 text-sm">
              {!data.cerrado && (
                <p className="text-muted-foreground">
                  Estimación del extremo alto: lo más probable es recibir igual o menos.
                </p>
              )}
              <p>
                Fecha de pago: <span className="font-medium">{formatDate(data.fecha_pago)}</span>
              </p>
              {data.muestra_insuficiente && (
                <p className="text-muted-foreground">
                  Pocos días con gasto: la estimación todavía es poco fiable.
                </p>
              )}
            </div>
          )}
        </BlockState>
      </CardContent>
    </Card>
  )
}
