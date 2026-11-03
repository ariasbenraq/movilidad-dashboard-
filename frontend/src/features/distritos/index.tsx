import { useAnaliticaDistritos } from '@/api/queries'
import type { DistritoAnalitica } from '@/api/types'
import { BlockState } from '@/components/block-state'
import { Main } from '@/components/layout/main'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePeriodo } from '@/context/period-provider'
import { formatPEN } from '@/lib/format'

function DistrictCard({ item }: { item: DistritoAnalitica }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {item.visitas} {item.visitas === 1 ? 'visita' : 'visitas'} en el periodo
        </CardDescription>
        <CardTitle className="text-lg">{item.distrito ?? 'Sin distrito mapeado'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="tabular-nums">{formatPEN(item.costo_total)}</span> en total ·{' '}
          <span className="tabular-nums">{formatPEN(item.costo_promedio)}</span> por visita
        </p>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Clientes</p>
          <div className="flex flex-wrap gap-1">
            {item.clientes.map((c) => (
              <Badge key={c.cliente} variant="secondary">{c.cliente} · {c.visitas}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">WO</p>
          <div className="flex flex-wrap gap-1">
            {item.workorders.map((w) => (
              <Badge key={w.workorder} variant="outline" className="font-mono">{w.workorder} · {w.visitas}</Badge>
            ))}
          </div>
        </div>
        <p className="border-t pt-3">
          Estimado del año: <span className="font-semibold">{item.visitas_anio_estimadas}</span> visitas
          <span className="text-muted-foreground">
            {' '}({item.visitas_anio_hasta_hoy} hasta hoy, {item.meses_restantes} meses restantes)
          </span>
        </p>
      </CardContent>
    </Card>
  )
}

export function DistritosPage() {
  const { periodo } = usePeriodo()
  const { data, isLoading, isError, refetch } = useAnaliticaDistritos(periodo)
  return (
    <Main title="Distritos">
      <p className="text-muted-foreground text-sm">
        Los viajes de vuelta cuentan como visita a su destino (normalmente el distrito de casa).
      </p>
      <BlockState
        isLoading={isLoading}
        isError={isError}
        isEmpty={data?.items.length === 0}
        emptyMessage="No hay visitas en este periodo."
        onRetry={() => void refetch()}
        skeletonClassName="h-48 w-full"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.items.map((item) => <DistrictCard key={item.distrito ?? 'sin-mapear'} item={item} />)}
        </div>
      </BlockState>
    </Main>
  )
}
