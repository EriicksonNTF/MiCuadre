"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <span className="text-2xl">⚠️</span>
      </div>
      <h1 className="mt-4 text-lg font-bold text-foreground">Algo salió mal</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Hubo un error al cargar la aplicación. Intenta de nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 w-full max-w-xs rounded-full bg-primary text-base font-bold text-primary-foreground"
      >
        Reintentar
      </button>
    </div>
  )
}
