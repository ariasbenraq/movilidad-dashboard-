import type { ReactNode } from 'react'

export function Main({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="flex-1 space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  )
}
