import { AlertTriangle } from 'lucide-react'
import type { Registro } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatPEN } from '@/lib/format'
import { reviewLabels } from './review'

// Only districts are shown; street addresses stay out of the list on purpose.
const place = (lugar: Registro['desde']) => lugar.distrito_canon ?? lugar.distrito ?? '—'

export function RegistrosTable({ items }: { items: Registro[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>WO</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead>Hacia</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead>Revisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r) => (
          <TableRow key={r.id} data-needs-review={r.needs_review} className={r.needs_review ? 'bg-amber-500/10' : undefined}>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.fecha)}
              {r.hora_inicio && <span className="text-muted-foreground"> · {r.hora_inicio}</span>}
            </TableCell>
            <TableCell className="font-mono text-xs">{r.workorder ?? '—'}</TableCell>
            <TableCell>{r.cliente ?? '—'}</TableCell>
            <TableCell>{place(r.desde)}</TableCell>
            <TableCell>{place(r.hacia)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPEN(r.total)}
              {r.otros_gastos > 0 && (
                <span className="text-muted-foreground block text-xs">
                  incl. otros {formatPEN(r.otros_gastos)}
                </span>
              )}
            </TableCell>
            <TableCell>
              {r.needs_review && (
                <div className="flex flex-wrap gap-1">
                  {reviewLabels(r.review_reason).map((label) => (
                    <Badge key={label} variant="outline" className="gap-1">
                      <AlertTriangle className="size-3" />
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
