import { useState } from 'react'
import { useRegistros } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePeriodo } from '@/context/period-provider'
import { DateRangeFilter, type DateRange } from './date-range-filter'
import { RegistrosTable } from './registros-table'

const LIMIT = 20

export function RegistrosPage() {
  const { periodo } = usePeriodo()
  const [range, setRange] = useState<DateRange>({ desde: '', hasta: '' })
  const [soloRevisar, setSoloRevisar] = useState(false)
  const [page, setPage] = useState(1)

  // The contract says `periodo` wins over `desde`/`hasta`, so an explicit date range
  // replaces the selected period instead of being ignored.
  // The backend rejects a range with only one end (400), so it applies only when both are set.
  const hasRange = range.desde !== '' && range.hasta !== ''
  const halfRange = !hasRange && (range.desde !== '' || range.hasta !== '')
  const { data, isLoading, isError, isFetching, refetch } = useRegistros({
    periodo: hasRange ? undefined : periodo,
    desde: hasRange ? range.desde : undefined,
    hasta: hasRange ? range.hasta : undefined,
    por_revisar: soloRevisar || undefined,
    page,
    limit: LIMIT,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <Main title="Registros">
      <DateRangeFilter
        value={range}
        onChange={(next) => { setRange(next); setPage(1) }}
        soloRevisar={soloRevisar}
        onSoloRevisarChange={(next) => { setSoloRevisar(next); setPage(1) }}
      />
      {halfRange && (
        <p className="text-muted-foreground text-sm">Elige las dos fechas para filtrar por rango.</p>
      )}
      <Card>
        <CardContent>
          <BlockState
            isLoading={isLoading}
            isError={isError}
            isEmpty={data?.items.length === 0}
            emptyMessage="No hay registros con estos filtros."
            onRetry={() => void refetch()}
            skeletonClassName="h-64 w-full"
          >
            {data && (
              <div className={isFetching ? 'opacity-60' : undefined}>
                <RegistrosTable items={data.items} />
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {data.total} registros · página {data.page} de {pages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </BlockState>
        </CardContent>
      </Card>
    </Main>
  )
}
