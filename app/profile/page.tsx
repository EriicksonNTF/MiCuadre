"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  User,
  Camera,
  Save,
  X,
  Edit3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProfile, updateProfile } from "@/hooks/use-data"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  const { data: profile, isLoading, mutate } = useProfile()
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || ""
      setName(fullName)
    }
  }, [profile])

  const handleStartEdit = () => {
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || ""
    setName(fullName)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setName("")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const nameParts = name.trim().split(" ")
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
      })
      await mutate()
      setIsEditing(false)
    } catch (error) {
      console.error("Error updating profile:", error)
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

    // Handle photo upload here
    console.log("Photo selected:", file.name)
  }

  if (isLoading) {
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
      {/* Header */}
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
        {/* Profile Display */}
        <div className="rounded-2xl bg-card p-6">
          {/* Avatar Section */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent to-emerald-600">
                <User className="h-12 w-12 text-white" />
              </div>
              <button
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg"
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

{/* Name Field */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nombre
            </label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground"
                placeholder="Tu nombre"
              />
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-foreground">
                {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Sin nombre"}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Correo electrónico
            </label>
            <p className="rounded-xl bg-muted px-4 py-3 text-foreground">
              {user?.email || "Sin correo"}
            </p>
          </div>

          {/* Email Field */}
<div className="mb-6">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Correo electrónico
            </label>
            <p className="rounded-xl bg-muted px-4 py-3 text-foreground">
              {user?.email || "Sin correo"}
            </p>
          </div>

          {/* Action Buttons */}
          {isEditing ? (
            <div className="flex gap-3">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          ) : (
            <Button onClick={handleStartEdit} className="w-full">
              <Edit3 className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}