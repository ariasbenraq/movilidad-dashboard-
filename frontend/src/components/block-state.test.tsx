import { render, screen } from '@testing-library/react'
import { BlockState } from './block-state'

describe('BlockState', () => {
  it('shows an alert with retry on error', () => {
    render(
      <BlockState isLoading={false} isError onRetry={() => {}}>
        contenido
      </BlockState>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('contenido')).not.toBeInTheDocument()
  })

  it('shows the empty message', () => {
    render(
      <BlockState isLoading={false} isError={false} isEmpty emptyMessage="Vacío">
        contenido
      </BlockState>,
    )
    expect(screen.getByText('Vacío')).toBeInTheDocument()
  })

  it('renders children when there is data', () => {
    render(
      <BlockState isLoading={false} isError={false}>
        contenido
      </BlockState>,
    )
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })
})
