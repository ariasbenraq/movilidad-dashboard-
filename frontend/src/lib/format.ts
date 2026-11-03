const TIME_ZONE = 'America/Lima'

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

export function formatPEN(value: number): string {
  return currency.format(value)
}

// Dates in the API are `YYYY-MM-DD` (calendar days) or ISO 8601 timestamps.
// Calendar days are formatted at noon UTC so the viewer's time zone cannot shift them.
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
