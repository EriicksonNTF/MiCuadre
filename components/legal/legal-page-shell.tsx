import Link from "next/link"
import { Instagram } from "lucide-react"

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm font-semibold text-accent hover:underline">
              MiCuadre
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/legal/privacidad" className="hover:text-foreground">Privacidad</Link>
              <Link href="/legal/terminos" className="hover:text-foreground">Terminos</Link>
              <Link href="/legal/aviso-legal" className="hover:text-foreground">Aviso Legal</Link>
            </nav>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ultima actualizacion: {updatedAt}</p>
        </header>

        <article className="prose prose-slate max-w-none rounded-2xl border border-border bg-card p-6 prose-h2:mt-8 prose-h2:text-xl prose-p:leading-7">
          {children}
        </article>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© 2026 MiCuadre. Todos los derechos reservados.</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground"
            aria-label="Instagram de MiCuadre (proximamente)"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </button>
        </footer>
      </div>
    </main>
  )
}
