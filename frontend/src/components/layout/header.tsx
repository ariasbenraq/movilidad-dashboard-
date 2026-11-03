import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { logout } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { PeriodPicker } from '@/components/period-picker'
import { ThemeSwitch } from '@/components/theme-switch'

export function Header({ username }: { username: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      queryClient.clear()
      await navigate({ to: '/login' })
    },
  })

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
      <SidebarTrigger aria-label="Alternar menú" />
      <Separator orientation="vertical" className="h-5" />
      <PeriodPicker />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground hidden text-sm sm:inline">{username}</span>
        <ThemeSwitch />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}

