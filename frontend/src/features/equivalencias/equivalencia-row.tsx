import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { distritoError } from './validate'

interface Props {
  /** Raw or normalized text this row maps. */
  texto: string
  initialDistrito?: string
  detail?: string
  saveLabel: string
  pending: boolean
  errorMessage?: string
  onSave: (distrito: string) => void
  onDelete?: () => void
}

export function EquivalenciaRow({
  texto,
  initialDistrito = '',
  detail,
  saveLabel,
  pending,
  errorMessage,
  onSave,
  onDelete,
}: Props) {
  const [distrito, setDistrito] = useState(initialDistrito)
  const [touched, setTouched] = useState(false)
  const error = touched ? distritoError(distrito) : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (distritoError(distrito) === null) onSave(distrito.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2 py-2">
      <div className="min-w-32 flex-1 pt-2 text-sm">
        <span className="font-mono">{texto}</span>
        {detail && <span className="text-muted-foreground block text-xs">{detail}</span>}
      </div>
      <div className="min-w-48 flex-1">
        <Input
          aria-label={`Distrito para ${texto}`}
          value={distrito}
          onChange={(event) => setDistrito(event.target.value)}
          aria-invalid={error !== null}
        />
        {(error ?? errorMessage) && (
          <p role="alert" className="text-destructive mt-1 text-xs">
            {error ?? errorMessage}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {saveLabel}
      </Button>
      {onDelete && (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onDelete}>
          Quitar
        </Button>
      )}
    </form>
  )
}
