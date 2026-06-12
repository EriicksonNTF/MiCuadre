"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageCircle, Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CoachResponse, CoachUIBlock, CoachAction } from "@/lib/coach-ia"
import { COACH_NAME } from "@/lib/coach-ia"
import { useAuth } from "@/hooks/use-auth"
import { useEntitlements } from "@/hooks/use-entitlements"
// Coach IA email whitelist checked server-side via /api/user/coach-ia-check

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  uiBlocks?: CoachUIBlock[]
  actions?: CoachAction[]
  disclaimer?: string
}

const quickPrompts = [
  "¿Cuánto me queda del presupuesto de comida?",
  "¿Qué pagos tengo esta semana?",
  "¿Cuánto debo en préstamos?",
  "¿Estoy cerca de pasarme del presupuesto?",
]

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-foreground">
        <p className="text-xs text-muted-foreground">MiCuadre está pensando...</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  )
}

function Block({ block }: { block: CoachUIBlock }) {
  if (block.type === "kpi_card") {
    return (
      <div className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{block.value}</p>
      </div>
    )
  }

  if (block.type === "warning_bar") {
    return (
      <div className="mt-2 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/20">
        <p className="text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">{block.title}</p>
        <p className="text-xs text-amber-800 dark:text-amber-200">{block.value}</p>
      </div>
    )
  }

  if (block.type === "category_list") {
    return (
      <div className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <div className="mt-1.5 space-y-1">
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
    <div className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
      <p className="font-medium">{block.title}</p>
      <p className="mt-1">{block.amount} · {block.category}</p>
    </div>
  )
}

export function CoachIAWidget() {
  const { user, loading: authLoading } = useAuth()
  const { canUseMIAAdvanced } = useEntitlements()
  const [emailWhitelisted, setEmailWhitelisted] = useState<boolean | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    setEmailWhitelisted(null)
    fetch("/api/user/coach-ia-check")
      .then((r) => r.json())
      .then((d) => setEmailWhitelisted(d.allowed))
      .catch(() => setEmailWhitelisted(false))
  }, [authLoading, user])
  
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      text: `Soy ${COACH_NAME}, tu coach financiero IA. Te ayudo con gastos, planificación y FinScore en corto.`,
    },
  ])

  const hasAccess = useMemo(() => {
    if (authLoading) return false
    if (emailWhitelisted === null && !canUseMIAAdvanced) return false
    return canUseMIAAdvanced || emailWhitelisted === true
  }, [canUseMIAAdvanced, emailWhitelisted, authLoading])

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading])

  async function sendMessage(value?: string) {
    const text = (value ?? input).trim()
    if (!text || loading) return

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, screenContext: "dashboard_widget", conversationId }),
      })
      
      if (res.status === 403) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: "El asistente de MIA requiere una suscripción Pro activa.",
          },
        ])
        return
      }

      const data = (await res.json()) as CoachResponse & { conversationId?: string }
      if (data.conversationId) {
        setConversationId(data.conversationId)
      }

      const bot: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data.answer,
        uiBlocks: data.uiBlocks,
        actions: data.actions,
        disclaimer: data.disclaimer,
      }
      setMessages((prev) => [...prev, bot])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Se cayó la conexión por un momento. Inténtalo de nuevo.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function confirmDraft(action: CoachAction) {
    if (loading || action.actionType !== "confirm_draft" || !action.mutationType) return
    setLoading(true)
    try {
      const res = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          confirmAction: {
            mutationType: action.mutationType,
            payload: action.payload || {},
          },
        }),
      })

      if (res.status === 403) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: "El asistente de MIA requiere una suscripción Pro activa.",
          },
        ])
        return
      }

      const data = (await res.json()) as CoachResponse
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
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
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "No pude confirmar esa acción ahora mismo. Inténtalo de nuevo.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !hasAccess) {
    return null
  }

  return (
    <div className="fixed bottom-[calc(5.85rem+env(safe-area-inset-bottom))] right-4 z-50 sm:right-6">
      {!open && (
        <button type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-xl backdrop-blur"
        >
          <div className="rounded-full bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-foreground">{COACH_NAME}</span>
          <MessageCircle className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {open && (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5 text-primary"><Sparkles className="h-4 w-4" /></div>
              <div>
                <p className="text-xs font-semibold text-foreground">{COACH_NAME}</p>
                <p className="text-[0.6875rem] text-muted-foreground">Copiloto financiero</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button type="button"
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.6875rem] font-medium text-foreground hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2.5 text-xs",
                  message.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card text-foreground"
                )}>
                  <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  {message.uiBlocks?.map((block, idx) => <Block key={`${message.id}-${idx}`} block={block} />)}

                  {!!message.actions?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.actions.map((action) => (
                        <button type="button"
                          key={`${message.id}-${action.label}`}
                          onClick={() => {
                            if (action.actionType === "confirm_draft") {
                              void confirmDraft(action)
                              return
                            }
                            window.location.href = action.href
                          }}
                          className="rounded-full bg-muted px-2.5 py-1 text-[0.6875rem] font-semibold text-foreground hover:bg-muted/80"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {message.disclaimer && (
                    <p className="mt-1.5 text-[0.625rem] text-muted-foreground">{message.disclaimer}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && <ThinkingBubble />}
          </div>

          <div className="border-t border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage()
                }}
                placeholder="Pregúntame algo..."
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
              <Button size="icon" className="h-9 w-9 rounded-lg" disabled={!canSend} onClick={() => sendMessage()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

