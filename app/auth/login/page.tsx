'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Apple, Chrome } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const getAuthRedirectTo = () => {
    const baseRedirect =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`

    const separator = baseRedirect.includes('?') ? '&' : '?'
    return `${baseRedirect}${separator}next=${encodeURIComponent('/')}`
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError('Correo y contrasena son requeridos')
      return
    }
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) throw error

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        router.push('/dashboard')
        router.refresh()
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single()

      const onboardingCompleted = Boolean(profile?.onboarding_completed)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('onboarding_completed', onboardingCompleted ? 'true' : 'false')
      }

      router.push(onboardingCompleted ? '/dashboard' : '/onboarding')
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Ha ocurrido un error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectTo(),
        },
      })

      if (error) throw error
    } catch (oauthError: unknown) {
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión con Google",
        variant: "destructive"
      })
      setError(oauthError instanceof Error ? oauthError.message : 'No se pudo iniciar con proveedor social')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <Image src="/icono-favicon.png" alt="MiCuadre" width={48} height={48} className="h-12 w-12 object-cover" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">MiCuadre</h1>
            <p className="text-sm text-muted-foreground">Tu copiloto financiero dominicano</p>
          </div>

          <Card className="border-border/50">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Iniciar Sesion</CardTitle>
              <CardDescription>
                Entra y recupera control de tu dinero en menos de un minuto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={isLoading}
                  onClick={() => handleOAuthLogin('google')}
                >
                  <Chrome className="mr-2 h-4 w-4" />
                  Continuar con Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="hidden h-11"
                  disabled={isLoading}
                  onClick={() => handleOAuthLogin('apple')}
                >
                  <Apple className="mr-2 h-4 w-4" />
                  Continuar con Apple
                </Button>
              </div>
              <p className="mb-4 text-center text-xs text-muted-foreground">o entra con tu correo</p>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo electronico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Contrasena</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11"
                    />
                     <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                      Olvidaste tu contrasena?
                    </Link>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
                  </Button>
                </div>
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  No tienes cuenta?{' '}
                    <Link href="/auth/sign-up" className="text-primary hover:underline underline-offset-4">
                      Registrate
                    </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
