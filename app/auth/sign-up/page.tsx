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

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [firstName, setFirstName] = useState('')
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('Las contrasenas no coinciden')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
          data: {
            first_name: firstName,
          },
        },
      })
      if (error) throw error
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('onboarding_completed', 'false')
      }
      router.push('/onboarding')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Ha ocurrido un error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignUp = async (provider: 'google' | 'apple') => {
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
      setError(oauthError instanceof Error ? oauthError.message : 'No se pudo registrar con proveedor social')
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
              <CardTitle className="text-xl">Crear Cuenta</CardTitle>
              <CardDescription>
                Crea tu cuenta y empieza a tomar mejores decisiones con tu dinero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={isLoading}
                  onClick={() => handleOAuthSignUp('google')}
                >
                  <Chrome className="mr-2 h-4 w-4" />
                  Continuar con Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="hidden h-11"
                  disabled={isLoading}
                  onClick={() => handleOAuthSignUp('apple')}
                >
                  <Apple className="mr-2 h-4 w-4" />
                  Registrarte con Apple
                </Button>
              </div>
              <p className="mb-4 text-center text-xs text-muted-foreground">o crea tu cuenta con correo</p>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Tu nombre"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11"
                    />
                  </div>
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
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Confirmar Contrasena</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      {error}
                    </p>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                  </Button>
                </div>
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Ya tienes cuenta?{' '}
                  <Link href="/auth/login" className="text-primary hover:underline underline-offset-4">
                    Inicia sesion
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
