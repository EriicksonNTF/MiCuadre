type CardSummaryGridProps = {
  currentBalance: string
  statementBalance: string
  minimumPayment: string
  availableBalance: string
  dueDate: string
}

export function CardSummaryGrid({ currentBalance, statementBalance, minimumPayment, availableBalance, dueDate }: CardSummaryGridProps) {
  const items = [
    { label: "Balance actual", value: currentBalance },
    { label: "Balance al corte", value: statementBalance },
    { label: "Pago minimo", value: minimumPayment },
    { label: "Disponible", value: availableBalance },
  ]

  return (
    <section className="rounded-[24px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Resumen de tarjeta</h3>
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">Pagar antes del {dueDate}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 truncate text-sm font-bold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
