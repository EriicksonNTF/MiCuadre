"use client"

import { memo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"

type SelectorItem = {
  id: string
  title: string
  subtitle?: string
  detail?: string
}

export const AccountCarouselSelector = memo(function AccountCarouselSelector({
  items,
  selectedId,
  onSelect,
  emptyMessage = "Crea tu primera cuenta",
  compact = false,
}: {
  items: SelectorItem[]
  selectedId: string
  onSelect: (id: string) => void
  emptyMessage?: string
  compact?: boolean
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const selected = itemRefs.current[selectedId]
    if (!selected) return
    selected.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [selectedId])

  const handleSelect = (id: string) => {
    onSelect(id)
    triggerHaptic("light")
  }

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="relative -mx-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 bg-gradient-to-l from-background to-transparent" />
      <div ref={scrollerRef} className="overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-3 px-4">
        {items.map((item) => {
          const selected = selectedId === item.id
          return (
            <button type="button"
              key={item.id}
              ref={(node) => {
                itemRefs.current[item.id] = node
              }}
              onClick={() => handleSelect(item.id)}
              aria-pressed={selected}
              className={cn(
                "w-[76vw] max-w-[190px] shrink-0 snap-center rounded-[22px] border p-4 text-left transition-all duration-300",
                compact ? "w-[65vw] max-w-[160px]" : "",
                selected
                  ? "scale-[1.04] border-primary bg-primary/10 shadow-lg ring-1 ring-primary/30"
                  : "border-border bg-card opacity-80"
              )}
            >
              <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
              {item.subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</p>}
              {item.detail && <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>}
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
})
