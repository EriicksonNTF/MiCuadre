"use client"

import { toast } from "sonner"

export type ToastData = {
  id: string
  title: string
  body?: string
  type?: "default" | "success" | "warning" | "error" | "info"
  duration?: number
}

type SonnerType = "success" | "error" | "warning" | "info"

let toastCounter = 0

export function showToast(input: Omit<ToastData, "id">): string {
  const id = `toast-${Date.now()}-${toastCounter++}`
  const description = input.body

  const options = {
    id,
    description,
    duration: input.duration ?? 3500,
  }

  switch (input.type) {
    case "success":
      toast.success(input.title, options)
      break
    case "error":
      toast.error(input.title, options)
      break
    case "warning":
      toast.warning(input.title, options)
      break
    case "info":
    case "default":
    default:
      toast.info(input.title, options)
      break
  }

  return id
}

export function ToastContainer() {
  return null
}
