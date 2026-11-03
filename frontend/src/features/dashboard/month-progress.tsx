import { useProyeccion } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { usePeriodo } from '@/context/period-provider'
import { formatPEN } from '@/lib/format'

export function MonthProgress() {
  const { periodo } = usePeriodo()
  const { data, isLoading, isError, refetch } = useProyeccion(periodo)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avance del mes</CardTitle>
      </CardHeader>
      <CardContent>
        <BlockState isLoading={isLoading} isError={isError} onRetry={() => void refetch()} skeletonClassName="h-16 w-full">
          {data && (
            <div className="space-y-3">
              <Progress value={data.progreso * 100} aria-label="Acumulado frente a proyectado" />
              <div className="flex justify-between text-sm">
                <span>
                  Acumulado <span className="font-medium tabular-nums">{formatPEN(data.acumulado)}</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  de {formatPEN(data.proyectado)}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Día {data.dias_transcurridos} de {data.dias_del_mes}
                {!data.cerrado && ` · ${data.dias_laborables_restantes} días laborables restantes`}
              </p>
            </div>
          )}
        </BlockState>
      </CardContent>
    </Card>
  )
}
