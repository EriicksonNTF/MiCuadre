"use client"
import { SwipeConfirmButton } from "@/components/ui/swipe-confirm-button"

interface PaymentSliderProps {
  amount: number
  currency?: string
  recipientName: string
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  loading?: boolean
  label?: string
  className?: string
}

export function PaymentSlider({ 
  amount, 
  currency = "DOP", 
  recipientName, 
  onConfirm, 
  disabled, 
  loading = false,
  label = "Desliza para confirmar",
  className 
}: PaymentSliderProps) {
  return (
    <SwipeConfirmButton
      label={label}
      loadingLabel="Procesando..."
      completedLabel="Confirmado"
      disabled={disabled}
      loading={loading}
      onConfirm={onConfirm}
      className={className}
      resetKey={`${amount}-${currency}-${recipientName}-${disabled ? "1" : "0"}`}
    />
  )
}
