import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function ErrorPage({ code, message }: { code: string; message: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-5xl font-bold">{code}</p>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
