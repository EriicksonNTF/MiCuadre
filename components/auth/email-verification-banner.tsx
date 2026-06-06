"use client"

import { useEffect, useState } from "react"
import { X, MailCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function EmailVerificationBanner({ className }: { className?: string }) {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("email_verification_dismissed") !== "true"
  })
  const [sending, setSending] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const checkEmailVerified = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && !user.email_confirmed_at) {
        setShow(true)
      }
    }
    checkEmailVerified()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !session.user.email_confirmed_at) {
        setShow(true)
      } else {
        setShow(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleResendVerification = async () => {
    setSending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: (await supabase.auth.getUser()).data.user?.email || "",
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      toast({ title: "Correo enviado", description: "Revisa tu bandeja de entrada para verificar tu email." })
    } catch (err) {
      toast({ title: "Error", description: "No se pudo reenviar el correo", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem("email_verification_dismissed", "true")
  }

  if (!show) return null

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom-4 duration-300 ease-[var(--ease-out-ios)] pb-nav-safe px-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur p-4 shadow-[var(--shadow-float)]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Verifica tu correo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Para mayor seguridad de tu cuenta, confirma tu dirección de email.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleDismiss}
              aria-label="Ocultar aviso de verificación"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 mobile-action-button h-11 rounded-2xl"
              onClick={handleResendVerification}
              disabled={sending}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Enviando...
                </>
              ) : (
                "Reenviar correo"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 rounded-2xl text-xs"
              onClick={handleDismiss}
            >
              Luego
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}