import { LayoutDashboard, Link2, MapPin, Receipt, type LucideIcon } from 'lucide-react'

export interface NavItem {
  title: string
  to: '/' | '/registros' | '/distritos' | '/equivalencias'
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { title: 'Resumen', to: '/', icon: LayoutDashboard },
  { title: 'Registros', to: '/registros', icon: Receipt },
  { title: 'Distritos', to: '/distritos', icon: MapPin },
  { title: 'Equivalencias', to: '/equivalencias', icon: Link2 },
]
