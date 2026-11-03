import { mockApi } from './mocks'
import { realApi, type ApiService } from './endpoints'

// The only switch between mocks and the real backend. Flip it when the
// endpoints exist; components and hooks do not change.
const USE_MOCKS = true

export const api: ApiService = USE_MOCKS ? mockApi : realApi
