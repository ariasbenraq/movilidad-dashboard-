import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe, meQueryKey } from '@/api/auth'
import { LoginPage } from '@/features/auth/login-page'

export const Route = createFileRoute('/login')({
  // A user who already has a session goes straight to the app.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient
      .fetchQuery({ queryKey: meQueryKey, queryFn: getMe, staleTime: 0 })
      .catch(() => null)
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})
