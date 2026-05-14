"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CoachResponse, CoachUIBlock, CoachAction } from "@/lib/coach-ia"
import { useAuth } from "@/hooks/use-auth"
import { isCoachIAEnabledForEmail } from "@/lib/feature-flags"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  uiBlocks?: CoachUIBlock[]
  actions?: CoachAction[]
  disclaimer?: string
}

const SUGGESTED_PROMPTS = [
  "Como voy este mes",
  "En que estoy gastando mas",
  "Subir mi FinScore",
  "Como van mis metas",
  "Estoy gastando mas que el mes pasado",
]

function BlockCard({ block }: { block: CoachUIBlock }) {
  if (block.type === "kpi_card") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{block.value}</p>
      </div>
    )
  }

  if (block.type === "warning_bar") {
    return (
      <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/20">
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{block.title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200">{block.value}</p>
      </div>
    )
  }

  if (block.type === "category_list") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <div className="mt-2 space-y-1.5">
          {block.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
      <p className="mt-1 text-sm text-foreground">{block.amount} · {block.category}</p>
    </div>
  )
}

export default function CoachIAPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      text: "Soy tu Coach IA de MiCuadre. Te respondo con tus datos reales y con acciones concretas para hoy.",
      actions: [{ label: "Agregar transaccion", href: "/expense", actionType: "navigate" }],
    },
  ])

  if (!loading && !isCoachIAEnabledForEmail(user?.email)) {
    return (
      <div className="min-h-[100dvh] bg-background p-6">
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold text-foreground">Coach IA no disponible</p>
          <p className="mt-1 text-xs text-muted-foreground">Esta funcion esta habilitada solo para pruebas internas.</p>
          <Button className="mt-4" onClick={() => router.push("/")}>Volver al inicio</Button>
        </div>
      </div>
    )
  }

  async function askCoach(question: string) {
    const trimmed = question.trim()
    if (!trimmed || sending) return

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)

    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, screenContext: "coach_page" }),
      })

      const data = (await response.json()) as CoachResponse
      const assistantMessage: Message = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        text: data.answer,
        uiBlocks: data.uiBlocks,
        actions: data.actions,
        disclaimer: data.disclaimer,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: "Ahora mismo no pude responderte. Dame un segundo y vuelve a intentar.",
          actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
        },
      ])
    } finally {
      setSending(false)
    }
  }

  async function confirmDraft(action: CoachAction) {
    if (sending || action.actionType !== "confirm_draft" || !action.mutationType) return
    setSending(true)
    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmAction: {
            mutationType: action.mutationType,
            payload: action.payload || {},
          },
        }),
      })

      const data = (await response.json()) as CoachResponse
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: data.answer,
          uiBlocks: data.uiBlocks,
          actions: data.actions,
          disclaimer: data.disclaimer,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: "No pude confirmar esa accion ahora mismo. Intenta otra vez.",
          actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-6 py-4">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Coach IA</h1>
            <p className="text-xs text-muted-foreground">Tu copiloto financiero dominicano</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-6 py-5">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Preguntale a MiCuadre</p>
              <p className="text-xs text-muted-foreground">Respuestas cortas con accion directa.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => askCoach(prompt)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3 pb-28">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "user" ? "max-w-[86%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground" : "max-w-[94%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-foreground"}>
                <p className="leading-relaxed">{message.text}</p>

                {message.uiBlocks?.map((block, index) => (
                  <BlockCard key={`${message.id}-block-${index}`} block={block} />
                ))}

                {!!message.actions?.length && message.role === "assistant" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <button
                        key={`${message.id}-${action.label}`}
                        onClick={() => {
                          if (action.actionType === "confirm_draft") {
                            void confirmDraft(action)
                            return
                          }
                          router.push(action.href)
                        }}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {message.disclaimer && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{message.disclaimer}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 px-4 pb-safe pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") askCoach(input)
            }}
            placeholder="Ej: En que estoy gastando mas?"
            className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <Button onClick={() => askCoach(input)} size="icon" disabled={sending} className="h-11 w-11 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
