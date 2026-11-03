import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { logout } from '@/api/auth'
import { ThemeProvider } from '@/context/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { routeTree } from './routeTree.gen'

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('app with mock api', () => {
  afterEach(async () => {
    await logout()
  })

  it('redirects to login without a session', async () => {
    renderApp('/registros')
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('logs in and shows the dashboard blocks', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.type(await screen.findByLabelText('Usuario'), 'renzo')
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/Estimación del extremo alto/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText(/Día 29 de 31/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('Acumulado diario', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('shows flagged records in the records page', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.type(await screen.findByLabelText('Usuario'), 'renzo')
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('link', { name: 'Registros' }))

    expect(await screen.findByText('Distrito sin equivalencia', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('Horas extra incompletas', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('maps an unmapped district and removes it from the pending list', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.type(await screen.findByLabelText('Usuario'), 'renzo')
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('link', { name: 'Equivalencias' }))

    const input = await screen.findByLabelText('Distrito para Ate vitarte', {}, { timeout: 4000 })
    await user.type(input, 'Ate')
    await user.click(input.closest('form')!.querySelector('button[type="submit"]')!)

    expect(await screen.findByText('No hay textos sin mapear.', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('shows the empty state for a period without data', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.type(await screen.findByLabelText('Usuario'), 'renzo')
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(await screen.findByRole('link', { name: 'Distritos' }))
    await screen.findByText(/Jesús María/, {}, { timeout: 4000 })

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '2026-09' } })
    expect(await screen.findByText('No hay visitas en este periodo.', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})
