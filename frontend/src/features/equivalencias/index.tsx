import { useDeleteEquivalencia, useEquivalencias, usePutEquivalencia } from '@/api/queries'
import { BlockState } from '@/components/block-state'
import { Main } from '@/components/layout/main'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EquivalenciaRow } from './equivalencia-row'

export function EquivalenciasPage() {
  const { data, isLoading, isError, refetch } = useEquivalencias()
  const put = usePutEquivalencia()
  const remove = useDeleteEquivalencia()
  const busy = put.isPending || remove.isPending
  const failure = put.isError || remove.isError ? 'No se pudo guardar el cambio.' : undefined

  return (
    <Main title="Equivalencias de distritos">
      <BlockState isLoading={isLoading} isError={isError} onRetry={() => void refetch()} skeletonClassName="h-48 w-full">
        {data && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sin mapear</CardTitle>
                <CardDescription>
                  Textos de registros que todavía no tienen distrito. Al guardar se revisan los registros afectados.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <BlockState isLoading={false} isError={false} isEmpty={data.sin_mapear.length === 0} emptyMessage="No hay textos sin mapear.">
                  {data.sin_mapear.map((item) => (
                    <EquivalenciaRow
                      key={item.texto}
                      texto={item.texto}
                      detail={`${item.registros} ${item.registros === 1 ? 'registro' : 'registros'}`}
                      saveLabel="Guardar"
                      pending={busy}
                      errorMessage={failure}
                      onSave={(distrito) => put.mutate({ texto: item.texto, distrito })}
                    />
                  ))}
                </BlockState>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapeados</CardTitle>
                <CardDescription>Quitar una equivalencia devuelve sus registros a "sin mapear".</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <BlockState isLoading={false} isError={false} isEmpty={data.items.length === 0} emptyMessage="Todavía no hay equivalencias.">
                  {data.items.map((item) => (
                    <EquivalenciaRow
                      key={`${item.texto_normalizado}:${item.distrito}`}
                      texto={item.texto_normalizado}
                      initialDistrito={item.distrito}
                      saveLabel="Actualizar"
                      pending={busy}
                      errorMessage={failure}
                      onSave={(distrito) => put.mutate({ texto: item.texto_normalizado, distrito })}
                      onDelete={() => remove.mutate(item.texto_normalizado)}
                    />
                  ))}
                </BlockState>
              </CardContent>
            </Card>
          </div>
        )}
      </BlockState>
    </Main>
  )
}
