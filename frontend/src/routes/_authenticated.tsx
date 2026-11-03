import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe, meQueryKey } from '@/api/auth'
import { ApiError } from '@/api/client'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.fetchQuery({
        queryKey: meQueryKey,
        queryFn: getMe,
        staleTime: 60_000,
      })
      return { me }
    } catch (error) {
      // Only a missing session goes to login; a network or server error shows the error page.
      if (error instanceof ApiError && error.status === 401) throw redirect({ to: '/login' })
      throw error
    }
  },
  component: function Layout() {
    const { me } = Route.useRouteContext()
    return <AuthenticatedLayout username={me.username} />
  },
})
