import { createFileRoute } from '@tanstack/react-router'
import { RegistrosPage } from '@/features/registros'

export const Route = createFileRoute('/_authenticated/registros')({
  component: RegistrosPage,
})
