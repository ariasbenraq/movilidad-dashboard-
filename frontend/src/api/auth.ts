import { api } from './index'

export const login = api.login
export const logout = api.logout
export const getMe = api.getMe

export const meQueryKey = ['auth', 'me'] as const
