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
  const displayName = profile?.first_name || user?.email?.split("@")[0] || "Usuario"
  const initials = profile?.first_name
    ? `${profile.first_name.charAt(0)}${profile.last_name?.charAt(0) || ""}`
    : displayName.substring(0, 2).toUpperCase()

  return (
    <header className="flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`}
            alt={displayName}
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[10px] text-muted-foreground">Bienvenido</p>
          <h1 className="text-sm font-semibold text-foreground">
            {displayName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {loading ? (
          <div className="h-10 w-24 rounded-full bg-muted/60" />
        ) : isAuthenticated ? (
          <>
            <Link
              href="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
              aria-label="Ajustes"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              href="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
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
