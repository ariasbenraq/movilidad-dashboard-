import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface BlockStateProps {
  isLoading: boolean
  isError: boolean
  isEmpty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  skeletonClassName?: string
  children: ReactNode
}

// Loading, error and empty states shared by every dashboard block.
export function BlockState({
  isLoading,
  isError,
  isEmpty = false,
  emptyMessage = 'No hay datos para mostrar.',
  onRetry,
  skeletonClassName = 'h-40 w-full',
  children,
}: BlockStateProps) {
  if (isLoading) return <Skeleton className={skeletonClassName} />
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm">
        <p className="text-destructive">No se pudieron cargar los datos.</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    )
  }
  if (isEmpty) return <p className="text-muted-foreground text-sm">{emptyMessage}</p>
  return <>{children}</>
}
