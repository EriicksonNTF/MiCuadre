import { cn } from "@/lib/utils"

export function SettingsSectionLabel({
  children,
  className,
  htmlFor,
}: {
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <h3
      className={cn(
        "px-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className
      )}
      {...(htmlFor ? { id: htmlFor } : {})}
    >
      {children}
    </h3>
  )
}
