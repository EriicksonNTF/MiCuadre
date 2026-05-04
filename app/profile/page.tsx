"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, User, Camera, Save, X, Edit3 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useProfile, updateProfile } from "@/hooks/use-data"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const supabase = createClient()

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function ProfilePage() {
  const { data: profile, isLoading, mutate } = useProfile()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [name, setName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Sin nombre"
  }, [profile?.first_name, profile?.full_name, profile?.last_name])

  const joinedDate = useMemo(() => {
    return formatDate(profile?.created_at ?? user?.created_at)
  }, [profile?.created_at, user?.created_at])

  useEffect(() => {
    if (!profile) return
    setName(profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "")
  }, [profile])

  const handleStartEdit = () => {
    setName(profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "")
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setName(profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const fullName = name.trim()
      const nameParts = fullName.split(" ").filter(Boolean)
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null

      await updateProfile({
        full_name: fullName || null,
        first_name: firstName,
        last_name: lastName,
        email: user?.email ?? null,
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
    if (!file || !user) return

    setIsUploading(true)
    try {
      const extension = file.name.split(".").pop() || "jpg"
      const filePath = `${user.id}/avatar.${extension}`

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
      toast({ title: "Error", description: "No se pudo actualizar la foto de perfil." })
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28">
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
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent to-emerald-600">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
              <button
                onClick={handlePhotoClick}
                disabled={isUploading}
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground"
                placeholder="Tu nombre"
              />
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{displayName}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Correo electrónico</label>
            <p className="rounded-xl bg-muted px-4 py-3 text-foreground">{user?.email || profile?.email || "Sin correo"}</p>
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cuenta creada</label>
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
    </div>
  )
}
