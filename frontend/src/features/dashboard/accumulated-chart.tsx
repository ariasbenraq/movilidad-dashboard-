import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDiario } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePeriodo } from '@/context/period-provider'
import { fillAccumulated } from '@/lib/chart-data'
import { formatDate, formatPEN } from '@/lib/format'

export function AccumulatedChart() {
  const { periodo } = usePeriodo()
  const { data, isLoading, isError, refetch } = useDiario(periodo)
  const points = data ? fillAccumulated(data.items) : []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acumulado diario</CardTitle>
      </CardHeader>
      <CardContent>
        <BlockState
          isLoading={isLoading}
          isError={isError}
          isEmpty={points.length === 0}
          emptyMessage="No hay gastos en este periodo."
          onRetry={() => void refetch()}
          skeletonClassName="h-64 w-full"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
                  tickFormatter={(value: number) => `S/ ${value}`}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value) => [formatPEN(Number(value)), 'Acumulado']}
                  labelFormatter={(_, payload) => (payload[0] ? formatDate(payload[0].payload.fecha) : '')}
                  contentStyle={{
                    background: 'var(--popover)',
                    color: 'var(--popover-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="acumulado"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BlockState>
      </CardContent>
    </Card>
  )
}
