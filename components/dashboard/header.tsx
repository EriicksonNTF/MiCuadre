"use client"

import { Bell } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-11 w-11">
          <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" alt="Usuario" />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">JD</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-xs text-muted-foreground">Bienvenido</p>
          <h1 className="text-base font-semibold text-foreground">Juan</h1>
        </div>
      </div>

      <button className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="sr-only">Notificaciones</span>
      </button>
    </header>
  )
}
