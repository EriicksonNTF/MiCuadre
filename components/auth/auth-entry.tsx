"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, Chrome, LogIn, UserPlus, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validations/auth"
import { requestPrecacheAfterLogin } from "@/lib/pwa/precache-routes"
import Image from "next/image"

type AuthMode = "choice" | "login" | "signup"

export function AuthEntry({ initialMode = "choice" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  })

  const signupForm = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  })

  const getAuthRedirectTo = () => {
    const baseRedirect =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`

    const separator = baseRedirect.includes("?") ? "&" : "?"
    return `${baseRedirect}${separator}next=${encodeURIComponent("/")}`
  }

  const handleOAuth = async (provider: "google" | "apple") => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getAuthRedirectTo() },
      })
      if (error) throw error
    } catch (oauthError: unknown) {
      toast({
        title: "Error",
        description: provider === "google" ? "No se pudo continuar con Google" : "No se pudo continuar con Apple",
        variant: "destructive",
      })
      setError(oauthError instanceof Error ? oauthError.message : "No se pudo iniciar con proveedor social")
      setIsLoading(false)
    }
  }

  const handleLogin = async (data: LoginInput) => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      })
      if (error) throw error

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        router.push("/dashboard")
        router.refresh()
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .single()

      const onboardingCompleted = Boolean(profile?.onboarding_completed)

      if (typeof window !== "undefined") {
        window.localStorage.setItem("onboarding_completed", onboardingCompleted ? "true" : "false")
      }

      requestPrecacheAfterLogin()

      router.push(onboardingCompleted ? "/dashboard" : "/onboarding")
      router.refresh()
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "Ha ocurrido un error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (data: SignupInput) => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
          data: { first_name: data.firstName.trim() },
        },
      })
      if (signUpError) throw signUpError

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      })
      if (signInError) throw signInError

      if (typeof window !== "undefined") {
        window.localStorage.setItem("onboarding_completed", "false")
      }

      requestPrecacheAfterLogin()

      router.push("/onboarding")
      router.refresh()
    } catch (signupError: unknown) {
      setError(signupError instanceof Error ? signupError.message : "Ha ocurrido un error")
    } finally {
      setIsLoading(false)
    }
  }

  const goBack = () => {
    setError(null)
    loginForm.reset()
    signupForm.reset()
    setMode("choice")
  }

  return (
    <main className="relative min-h-[100dvh] bg-background px-5 flex items-center justify-center py-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] overflow-hidden">
      {/* Fondo decorativo con rejilla y figuras animadas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Patrón de cuadrícula sutil */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:16px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        
        {/* Sombras suaves e iluminaciones cálidas (sin manchas verdes discordantes) */}
        <div className="absolute -left-20 top-10 w-72 h-72 rounded-full bg-primary/3 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute -right-20 bottom-10 w-80 h-80 rounded-full bg-gold/5 blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
        
        {/* Figuras geométricas y líneas de diseño flotantes */}
        <svg className="absolute left-10 top-1/4 h-32 w-32 text-primary/8 animate-[spin_25s_linear_infinite]" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="0.5" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.25" />
        </svg>

        <svg className="absolute right-12 bottom-1/4 h-44 w-44 text-gold/8 animate-[spin_40s_linear_infinite_reverse]" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" />
          <path d="M50 8 L50 92 M8 50 L92 50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
          <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="0.75" fill="currentColor" fillOpacity="0.01" />
        </svg>

        <div className="absolute left-1/4 bottom-16 w-3 h-3 rounded-full bg-primary/10 animate-ping" />
        <div className="absolute right-1/3 top-16 w-2.5 h-2.5 rounded-full bg-gold/15 animate-pulse" />
      </div>

      <div className="mx-auto max-w-sm w-full relative z-10">
        <div className="relative overflow-hidden bg-card/60 backdrop-blur-md border border-border/40 rounded-[2rem] p-6 md:p-8 shadow-soft">
          {mode === "choice" ? (
            <div className="space-y-8 animate-in fade-in duration-400 ease-[var(--ease-out-ios)]">
              <div className="text-center space-y-4">
                {/* Logo animado y más grande */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-card border border-border/70 shadow-soft animate-[floatY_4s_ease-in-out_infinite] hover:scale-105 transition-transform duration-300">
                  <Image src="/icono-favicon.png" alt="MiCuadre Logo" width={80} height={80} className="h-14 w-14 object-contain" priority />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground pt-2">Tu dinero, más organizado</h1>
                <p className="text-base leading-relaxed text-muted-foreground max-w-[28ch] mx-auto">
                  Gestiona cuentas, pagos y metas financieras fácilmente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Opciones de acceso">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mobile-action-button h-14 rounded-2xl gap-2"
                  onClick={() => setMode("login")}
                  aria-label="Iniciar sesión con correo"
                >
                  <LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Iniciar sesión</span>
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  className="mobile-action-button h-14 rounded-2xl gap-2"
                  onClick={() => setMode("signup")}
                  aria-label="Crear cuenta nueva"
                >
                  <UserPlus className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Crear cuenta</span>
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full mobile-action-button h-12 rounded-2xl gap-2"
                onClick={() => handleOAuth("google")}
                disabled={isLoading}
              >
                <Chrome className="h-5 w-5 shrink-0" aria-hidden="true" />
                Continuar con Google
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-[var(--ease-out-ios)]">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-1.5 text-muted-foreground hover:text-foreground h-9 min-h-0 px-3 rounded-xl hover:bg-muted"
                  onClick={goBack}
                  aria-label="Volver a opciones de acceso"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Volver
                </Button>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/70 shadow-sm animate-[floatY_4s_ease-in-out_infinite]">
                  <Image src="/icono-favicon.png" alt="MiCuadre" width={40} height={40} className="h-7 w-7 object-contain" />
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-black tracking-tight text-foreground">
                  {mode === "login" ? "Iniciar sesión" : "Crear tu cuenta"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "login"
                    ? "Entra con tu correo o continua con Google."
                    : "Configura MiCuadre y pasa por el onboarding."}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full mobile-action-button h-12 rounded-2xl gap-2"
                onClick={() => handleOAuth("google")}
                disabled={isLoading}
              >
                <Chrome className="h-5 w-5 shrink-0" aria-hidden="true" />
                Continuar con Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs text-muted-foreground px-4">
                  <span className="bg-background px-2">{mode === "login" ? "o entra con tu correo" : "o crea tu cuenta con correo"}</span>
                </div>
              </div>

              {mode === "login" ? (
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">Correo electrónico</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      className="h-14 rounded-2xl"
                      {...loginForm.register("email")}
                      disabled={isLoading}
                      aria-invalid={!!loginForm.formState.errors.email}
                      aria-describedby={loginForm.formState.errors.email ? "login-email-error" : undefined}
                    />
                    {loginForm.formState.errors.email && (
                      <p id="login-email-error" className="text-sm text-destructive" role="alert">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-sm font-medium">Contraseña</Label>
                      <a href="/auth/forgot-password" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</a>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-14 rounded-2xl"
                      {...loginForm.register("password")}
                      disabled={isLoading}
                      aria-invalid={!!loginForm.formState.errors.password}
                      aria-describedby={loginForm.formState.errors.password ? "login-password-error" : undefined}
                    />
                    {loginForm.formState.errors.password && (
                      <p id="login-password-error" className="text-sm text-destructive" role="alert">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full mobile-action-button h-14 rounded-2xl"
                    disabled={isLoading || loginForm.formState.isSubmitting}
                  >
                    {isLoading || loginForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar sesión"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={signupForm.handleSubmit(handleSignUp)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm font-medium">Nombre</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Tu nombre"
                      autoComplete="given-name"
                      className="h-14 rounded-2xl"
                      {...signupForm.register("firstName")}
                      disabled={isLoading}
                      aria-invalid={!!signupForm.formState.errors.firstName}
                      aria-describedby={signupForm.formState.errors.firstName ? "signup-name-error" : undefined}
                    />
                    {signupForm.formState.errors.firstName && (
                      <p id="signup-name-error" className="text-sm text-destructive" role="alert">
                        {signupForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">Correo electrónico</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      className="h-14 rounded-2xl"
                      {...signupForm.register("email")}
                      disabled={isLoading}
                      aria-invalid={!!signupForm.formState.errors.email}
                      aria-describedby={signupForm.formState.errors.email ? "signup-email-error" : undefined}
                    />
                    {signupForm.formState.errors.email && (
                      <p id="signup-email-error" className="text-sm text-destructive" role="alert">
                        {signupForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">Contraseña</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="h-14 rounded-2xl"
                      {...signupForm.register("password")}
                      disabled={isLoading}
                      aria-invalid={!!signupForm.formState.errors.password}
                      aria-describedby={signupForm.formState.errors.password ? "signup-password-error" : undefined}
                    />
                    {signupForm.formState.errors.password && (
                      <p id="signup-password-error" className="text-sm text-destructive" role="alert">
                        {signupForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm" className="text-sm font-medium">Confirmar contraseña</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="h-14 rounded-2xl"
                      {...signupForm.register("confirmPassword")}
                      disabled={isLoading}
                      aria-invalid={!!signupForm.formState.errors.confirmPassword}
                      aria-describedby={signupForm.formState.errors.confirmPassword ? "signup-confirm-error" : undefined}
                    />
                    {signupForm.formState.errors.confirmPassword && (
                      <p id="signup-confirm-error" className="text-sm text-destructive" role="alert">
                        {signupForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full mobile-action-button h-14 rounded-2xl"
                    disabled={isLoading || signupForm.formState.isSubmitting}
                  >
                    {isLoading || signupForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear cuenta"
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}