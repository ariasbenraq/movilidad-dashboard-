import { createFileRoute } from '@tanstack/react-router'
import { EquivalenciasPage } from '@/features/equivalencias'

export const Route = createFileRoute('/_authenticated/equivalencias')({
  component: EquivalenciasPage,
})
