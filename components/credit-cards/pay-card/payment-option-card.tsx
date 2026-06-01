"use client"

type PaymentOptionCardProps = {
  title: string
  description?: string
  amount?: string
  selected: boolean
  onClick: () => void
}

export function PaymentOptionCard({ title, description, amount, selected, onClick }: PaymentOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[24px] border bg-card p-4 text-left transition ${selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:bg-muted/50"}`}
    >
      <div className="flex items-center gap-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-transparent"}`}>
          {selected ? "OK" : ""}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight text-foreground">{title}</p>
          {description ? <p className="mt-1 text-sm leading-snug text-muted-foreground">{description}</p> : null}
        </div>
        {amount ? <p className="shrink-0 text-sm font-semibold text-foreground">{amount}</p> : null}
      </div>
    </button>
  )
}
