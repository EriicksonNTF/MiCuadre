"use client"

import { useEffect, useMemo, useRef, useState, useReducer } from "react"
import Link from "next/link"
import { ChevronLeft, User, Camera, Save, X, Edit3 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useProfile, updateProfile } from "@/hooks/use-data"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"
import { MobilePageShell } from "@/components/ui/mobile-foundation"
import { useToast } from "@/hooks/use-toast"
import type { Profile } from "@/lib/types/database"

const supabase = createClient()

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// React 19: useReducer for profile form state to avoid 7 separate setState calls
// in a single useEffect (cascading re-renders)
type ProfileFormState = {
  name: string
  username: string
  phone: string
  preferredCurrency: "DOP" | "USD"
  theme: "light" | "dark" | "system"
  language: "es" | "en"
}

function profileFormReducer(state: ProfileFormState, action: { type: string; payload?: ProfileFormState }): ProfileFormState {
  switch (action.type) {
    case "UPDATE_FROM_PROFILE":
      return action.payload ?? state
    case "RESET":
      return action.payload ?? state
    default:
      return state
  }
}

function getInitialFormState(profile: Profile | null | undefined): ProfileFormState {
  if (!profile) {
    return {
      name: "",
      username: "",
      phone: "",
      preferredCurrency: "DOP",
      theme: "system",
      language: "es",
    }
  }
  return {
    name: profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "",
    username: String((profile as unknown as Record<string, unknown>).username || ""),
    phone: String((profile as unknown as Record<string, unknown>).phone || ""),
    preferredCurrency: (profile.preferred_currency as "DOP" | "USD") || "DOP",
    theme: (profile.theme as "light" | "dark" | "system") || "system",
    language: (profile.language as "es" | "en") || "es",
  }
}

export default function ProfilePage() {
  const { data: profile, isLoading, mutate } = useProfile()
  const { user, loading: authLoading } = useAuth()
  const { theme: _, setTheme: setAppTheme } = useTheme()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use useReducer to manage all profile form fields together
  const [formState, dispatch] = useReducer(
    profileFormReducer,
    profile,
    getInitialFormState
  )

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Sin nombre"
  }, [profile?.first_name, profile?.full_name, profile?.last_name])

  const joinedDate = useMemo(() => {
    return formatDate(profile?.created_at ?? user?.created_at)
  }, [profile?.created_at, user?.created_at])

  // Sync form state when profile changes (single dispatch instead of 7 setState calls)
  useEffect(() => {
    if (!profile) return
    dispatch({ type: "UPDATE_FROM_PROFILE", payload: getInitialFormState(profile) })
  }, [profile])

  const handleStartEdit = () => {
    // Form state already synced via useEffect, just enable editing
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form state from current profile
    if (profile) {
      dispatch({ type: "RESET", payload: getInitialFormState(profile) })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const fullName = formState.name.trim()
      const nameParts = fullName.split(" ").filter(Boolean)
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null

      await updateProfile({
        full_name: fullName || null,
        first_name: firstName,
        last_name: lastName,
        username: formState.username.trim() || null,
        phone: formState.phone.trim() || null,
        email: user?.email ?? null,
        preferred_currency: formState.preferredCurrency,
        theme: formState.theme,
        language: formState.language,
      })

      await mutate()
      setIsEditing(false)
      toast({ title: "Perfil actualizado", description: "Tus cambios se guardaron correctamente." })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({ title: "Error", description: "No se pudo actualizar el perfil." })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const authUser = authData.user
      if (authError || !authUser) {
        toast({ title: "Sesión requerida", description: "Inicia sesión para actualizar tu foto." })
        return
      }
      const extension = file.name.split(".").pop() || "jpg"
      const filePath = `${authUser.id}/avatar.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
      await updateProfile({ avatar_url: data.publicUrl })
      await mutate()

      toast({ title: "Perfil actualizado", description: "Foto de perfil actualizada." })
    } catch (error) {
      console.error("Error uploading avatar:", error)
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : ""
      const message = rawMessage.toLowerCase().includes("bucket not found")
        ? "Falta configurar el bucket 'avatars' en Supabase. Ejecuta scripts/009_storage_buckets_setup.sql."
        : rawMessage.toLowerCase().includes("row-level security policy")
        ? "No tienes permisos de carga en el bucket de avatars. Ejecuta scripts/022_avatar_storage_rls_and_push_subscriptions.sql en Supabase y vuelve a intentar."
        : rawMessage || "No se pudo actualizar la foto de perfil."
      toast({ title: "Error", description: message })
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  if (isLoading || authLoading) {
    return (
      <MobilePageShell fullBleed className="pb-nav-safe">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Mi perfil</h1>
          </div>
        </div>
        <div className="mx-auto flex max-w-md items-center justify-center pt-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
        </div>
      </MobilePageShell>
    )
  }

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Mi perfil</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-6 pt-6">
        <div className="rounded-2xl bg-card p-6">
          <div className="mb-6 flex flex-col items-center">
            <div className="relative">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent to-emerald-600 dark:to-emerald-700">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
              <button type="button"
                onClick={handlePhotoClick}
                disabled={isUploading}
                aria-label="Cambiar foto de perfil"
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg disabled:opacity-50"
              >
                <Camera className="h-4 w-4 text-primary-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="profile-name" className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</label>
            {isEditing ? (
              <input
                id="profile-name"
                type="text"
                value={formState.name}
                onChange={(e) => dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, name: e.target.value } })}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground"
                placeholder="Tu nombre"
              />
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{displayName}</p>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="profile-username" className="mb-1 block text-xs font-medium text-muted-foreground">Usuario</label>
              {isEditing ? (
                <input id="profile-username" type="text" value={formState.username} onChange={(e) => dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, username: e.target.value } })} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground" placeholder="nombre de usuario" />
              ) : (
                <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{formState.username || "-"}</p>
              )}
            </div>
            <div>
              <label htmlFor="profile-phone" className="mb-1 block text-xs font-medium text-muted-foreground">Teléfono</label>
              {isEditing ? (
                <input id="profile-phone" type="tel" value={formState.phone} onChange={(e) => dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, phone: e.target.value } })} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground" placeholder="809..." />
              ) : (
                <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{formState.phone || "-"}</p>
              )}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="profile-currency" className="mb-1 block text-xs font-medium text-muted-foreground">Moneda</label>
              {isEditing ? (
                <select id="profile-currency" value={formState.preferredCurrency} onChange={(e) => dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, preferredCurrency: e.target.value as "DOP" | "USD" } })} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-foreground">
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              ) : (
                <p className="rounded-xl bg-muted px-3 py-3 text-foreground">{profile?.preferred_currency || "DOP"}</p>
              )}
            </div>
            <div>
              <label htmlFor="profile-theme" className="mb-1 block text-xs font-medium text-muted-foreground">Tema</label>
              {isEditing ? (
                <select id="profile-theme" value={formState.theme} onChange={(e) => { const t = e.target.value as "light" | "dark" | "system"; dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, theme: t } }); setAppTheme(t) }} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-foreground">
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              ) : (
                <p className="rounded-xl bg-muted px-3 py-3 text-foreground">{profile?.theme || "system"}</p>
              )}
            </div>
            <div>
              <label htmlFor="profile-language" className="mb-1 block text-xs font-medium text-muted-foreground">Idioma</label>
              {isEditing ? (
                <select id="profile-language" value={formState.language} onChange={(e) => dispatch({ type: "UPDATE_FROM_PROFILE", payload: { ...formState, language: e.target.value as "es" | "en" } })} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-foreground">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              ) : (
                <p className="rounded-xl bg-muted px-3 py-3 text-foreground">{profile?.language || "es"}</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Correo electrónico</span>
            <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{user?.email || profile?.email || "Sin correo"}</p>
          </div>

          <div className="mb-6">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Cuenta creada</span>
            <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{joinedDate}</p>
          </div>

          {isEditing ? (
            <div className="flex gap-3">
              <Button onClick={handleCancel} variant="outline" className="flex-1" disabled={isSaving}>
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          ) : (
            <Button onClick={handleStartEdit} className="w-full" disabled={isUploading}>
              <Edit3 className="h-4 w-4" />
              {isUploading ? "Subiendo foto..." : "Editar"}
            </Button>
          )}
        </div>
      </div>
    </MobilePageShell>
  )
}
