import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer needs.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no matchMedia (theme provider, sidebar).
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

// Tests always run against the typed mocks, whatever the app uses at runtime.
vi.mock('@/api/index', async () => {
  const { mockApi } = await import('@/api/mocks')
  return { api: mockApi }
})
