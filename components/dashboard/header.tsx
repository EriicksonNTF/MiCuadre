"use client"

import { Bell, Settings } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useProfile, useNotifications } from "@/hooks/use-data"

export function Header() {
  const { user, isAuthenticated, loading } = useAuth()
  const { data: profile } = useProfile()
  const { data: notifications } = useNotifications()

  const unreadCount = notifications?.filter((n) => !n.read).length || 0
  const displayName = profile?.full_name || profile?.first_name || user?.email?.split("@")[0] || "Usuario"
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "US"

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage
            src={profile?.avatar_url || undefined}
            alt={displayName}
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Bienvenido</p>
          <h1 className="truncate text-base font-bold text-foreground">
            {displayName}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {loading ? (
          <div className="h-11 w-24 rounded-full bg-muted/60" />
        ) : isAuthenticated ? (
          <>
            <Link
              href="/settings"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-muted active:scale-95"
              aria-label="Ajustes"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href="/notifications"
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-muted active:scale-95"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </>
        ) : (
          <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  )
}
