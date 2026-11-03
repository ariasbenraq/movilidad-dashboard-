import { createFileRoute } from '@tanstack/react-router'
import { DistritosPage } from '@/features/distritos'

export const Route = createFileRoute('/_authenticated/distritos')({
  component: DistritosPage,
})
