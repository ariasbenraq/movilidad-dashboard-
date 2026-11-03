import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './index'
import type { EquivalenciaRequest, Periodo, RegistrosQuery } from './types'

export const queryKeys = {
  resumen: (periodo?: Periodo) => ['resumen', periodo] as const,
  proyeccion: (periodo?: Periodo) => ['proyeccion', periodo] as const,
  diario: (periodo?: Periodo) => ['diario', periodo] as const,
  registros: (query: RegistrosQuery) => ['registros', query] as const,
  distritos: (periodo?: Periodo) => ['analitica', 'distritos', periodo] as const,
  equivalencias: ['distritos', 'equivalencias'] as const,
}

export const useResumen = (periodo?: Periodo) =>
  useQuery({ queryKey: queryKeys.resumen(periodo), queryFn: () => api.getResumen(periodo) })

export const useProyeccion = (periodo?: Periodo) =>
  useQuery({ queryKey: queryKeys.proyeccion(periodo), queryFn: () => api.getProyeccion(periodo) })

export const useDiario = (periodo?: Periodo) =>
  useQuery({ queryKey: queryKeys.diario(periodo), queryFn: () => api.getDiario(periodo) })

export const useRegistros = (query: RegistrosQuery = {}) =>
  useQuery({
    queryKey: queryKeys.registros(query),
    queryFn: () => api.getRegistros(query),
    placeholderData: keepPreviousData,
  })

export const useAnaliticaDistritos = (periodo?: Periodo) =>
  useQuery({ queryKey: queryKeys.distritos(periodo), queryFn: () => api.getAnaliticaDistritos(periodo) })

export const useEquivalencias = () =>
  useQuery({ queryKey: queryKeys.equivalencias, queryFn: () => api.getEquivalencias() })

// Changing an equivalence re-derives records and district analytics on the backend.
function useInvalidateDistricts() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.equivalencias }),
      queryClient.invalidateQueries({ queryKey: ['analitica', 'distritos'] }),
      queryClient.invalidateQueries({ queryKey: ['registros'] }),
    ])
}

export function usePutEquivalencia() {
  const invalidate = useInvalidateDistricts()
  return useMutation({
    mutationFn: (body: EquivalenciaRequest) => api.putEquivalencia(body),
    onSuccess: invalidate,
  })
}

export function useDeleteEquivalencia() {
  const invalidate = useInvalidateDistricts()
  return useMutation({
    mutationFn: (textoNormalizado: string) => api.deleteEquivalencia(textoNormalizado),
    onSuccess: invalidate,
  })
}
