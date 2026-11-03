import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ErrorPage } from '@/features/errors/error-page'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  notFoundComponent: () => <ErrorPage code="404" message="Página no encontrada." />,
  errorComponent: () => <ErrorPage code="500" message="No se pudo conectar con el servidor." />,
})
