import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Verifica tu correo</CardTitle>
          <CardDescription>
            Debes confirmar tu correo para entrar a MiCuadre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Revisa tu bandeja de entrada y luego vuelve a iniciar sesion.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Ir a iniciar sesion</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
