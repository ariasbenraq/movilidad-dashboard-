import { Outlet } from '@tanstack/react-router'
import { PeriodProvider } from '@/context/period-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Header } from './header'

export function AuthenticatedLayout({ username }: { username: string }) {
  return (
    <PeriodProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header username={username} />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
    </PeriodProvider>
  )
}
