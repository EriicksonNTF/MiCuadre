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
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm font-semibold text-[#0f766e] hover:underline">
              MiCuadre
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/legal/privacidad" className="hover:text-slate-900">Privacidad</Link>
              <Link href="/legal/terminos" className="hover:text-slate-900">Terminos</Link>
              <Link href="/legal/aviso-legal" className="hover:text-slate-900">Aviso Legal</Link>
            </nav>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">Ultima actualizacion: {updatedAt}</p>
        </header>

        <article className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-white p-6 prose-h2:mt-8 prose-h2:text-xl prose-p:leading-7">
          {children}
        </article>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>© 2026 MiCuadre. Todos los derechos reservados.</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-600"
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
