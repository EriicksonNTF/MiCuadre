"use client"

import { useState, useRef, useEffect, useCallback, Children, cloneElement, type ReactElement } from "react"
import { SlideUpModal } from "@/components/ui/slide-up-modal"
import { cn } from "@/lib/utils"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

interface DateWheelPickerProps {
  value: Date
  onChange: (date: Date) => void
  children: ReactElement<{ onClick?: (e: React.MouseEvent) => void; ref?: React.Ref<unknown> }>
}

export function DateWheelPicker({ value, onChange, children }: DateWheelPickerProps) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState(value.getDate())
  const [month, setMonth] = useState(value.getMonth())
  const [year, setYear] = useState(value.getFullYear())

  const daysCount = getDaysInMonth(year, month)
  const days = Array.from({ length: daysCount }, (_, i) => i + 1)
  const months = Array.from({ length: 12 }, (_, i) => i)
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i)

  const handleConfirm = () => {
    const clampedDay = Math.min(day, getDaysInMonth(year, month))
    onChange(new Date(year, month, clampedDay))
    setOpen(false)
  }

  const handleOpen = () => {
    setDay(value.getDate())
    setMonth(value.getMonth())
    setYear(value.getFullYear())
    setOpen(true)
  }

  const trigger = Children.only(children)
  const enhancedTrigger = cloneElement(trigger, {
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e)
      handleOpen()
    },
  })

  return (
    <>
      {enhancedTrigger}
      <SlideUpModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Seleccionar fecha"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 rounded-2xl border border-border bg-background text-sm font-semibold text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-12 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Confirmar
            </button>
          </div>
        }
      >
        <div className="flex gap-2">
          <WheelColumn<number>
            items={days}
            label="Día"
            selected={day}
            onSelect={setDay}
            displayItem={(d) => String(d).padStart(2, "0")}
          />
          <WheelColumn<number>
            items={months}
            label="Mes"
            selected={month}
            onSelect={setMonth}
            displayItem={(m) => MONTHS[m]}
          />
          <WheelColumn<number>
            items={years}
            label="Año"
            selected={year}
            onSelect={setYear}
            displayItem={(y) => String(y)}
          />
        </div>
      </SlideUpModal>
    </>
  )
}

interface WheelColumnProps<T> {
  items: T[]
  label: string
  selected: T
  onSelect: (value: T) => void
  displayItem: (value: T) => string
}

function WheelColumn<T extends string | number>({
  items,
  label,
  selected,
  onSelect,
  displayItem,
}: WheelColumnProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const tickingRef = useRef(false)

  const handleScroll = useCallback(() => {
    const container = ref.current
    if (!container || tickingRef.current) return
    tickingRef.current = true
    requestAnimationFrame(() => {
      const center = container.scrollTop + container.clientHeight / 2
      const children = container.children
      let closestIdx = 0
      let closestDist = Infinity
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement
        const itemCenter = child.offsetTop + child.offsetHeight / 2
        const dist = Math.abs(center - itemCenter)
        if (dist < closestDist) {
          closestDist = dist
          closestIdx = i
        }
      }
      onSelect(items[closestIdx])
      tickingRef.current = false
    })
  }, [items, onSelect])

  useEffect(() => {
    const container = ref.current
    if (!container) return
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (!ref.current) return
    const idx = items.indexOf(selected)
    if (idx < 0) return
    const child = ref.current.children[idx] as HTMLElement | undefined
    child?.scrollIntoView({ block: "center" })
  }, [])

  return (
    <div className="relative flex-1">
      <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-t border-b border-border/50" />
        <div
          ref={ref}
          className="h-40 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="h-[calc(5rem-0.5px)] shrink-0" />
          {items.map((item, i) => {
            const isSelected = item === selected
            return (
              <div
                key={i}
                data-wheel-item
                className={cn(
                  "flex h-10 snap-center items-center justify-center text-sm transition-colors",
                  isSelected
                    ? "font-bold text-foreground"
                    : "text-muted-foreground/60",
                )}
              >
                {displayItem(item)}
              </div>
            )
          })}
          <div className="h-[calc(5rem-0.5px)] shrink-0" />
        </div>
      </div>
    </div>
  )
}
