"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useProfile, useNotifications } from "@/hooks/use-data"

export function Header() {
  const { user, isAuthenticated } = useAuth()
  const { data: profile } = useProfile()
  const { data: notifications } = useNotifications()

  const unreadCount = notifications?.filter((n) => !n.read).length || 0
  const displayName = profile?.first_name || user?.email?.split("@")[0] || "Usuario"
  const initials = profile?.first_name
    ? `${profile.first_name.charAt(0)}${profile.last_name?.charAt(0) || ""}`
    : displayName.substring(0, 2).toUpperCase()

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-11 w-11">
          <AvatarImage
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`}
            alt={displayName}
          />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-xs text-muted-foreground">Bienvenido</p>
          <h1 className="text-base font-semibold text-foreground">
            {displayName}
          </h1>
        </div>
      </div>

      {isAuthenticated ? (
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0
              ? `${unreadCount} notificaciones sin leer`
              : "Notificaciones"}
          </span>
        </Link>
      ) : (
        <Link
          href="/auth/login"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Iniciar sesión
        </Link>
      )}
    </header>
  )
}
