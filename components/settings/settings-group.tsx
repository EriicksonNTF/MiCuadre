import { cn } from "@/lib/utils"

export function SettingsGroup({
  children,
  className,
  divided = true,
}: {
  children: React.ReactNode
  className?: string
  divided?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        divided && "[&>*+*]:border-t [&>*+*]:border-border",
        className
      )}
    >
      {children}
    </div>
  )
}
