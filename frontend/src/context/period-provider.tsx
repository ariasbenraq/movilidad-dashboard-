import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Periodo } from '@/api/types'

interface PeriodContextValue {
  /** undefined means "the backend default" (the current month in America/Lima). */
  periodo: Periodo | undefined
  setPeriodo: (periodo: Periodo | undefined) => void
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo | undefined>(undefined)
  return <PeriodContext.Provider value={{ periodo, setPeriodo }}>{children}</PeriodContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePeriodo(): PeriodContextValue {
  const context = useContext(PeriodContext)
  if (!context) throw new Error('usePeriodo must be used inside PeriodProvider')
  return context
}
