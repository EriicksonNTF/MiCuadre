const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/accounts/account-detail.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /import \{\n  ChevronLeft,\n  Banknote,/,
  `import {\n  ChevronLeft,\n  ChevronDown,\n  CalendarDays,\n  Banknote,`
);

const oldSummary = `      {/* Summary Section */}
      <div className="px-6 pt-6">
        <h2 className="text-sm font-semibold text-foreground">Resumen del mes</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(monthlyIncome)}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 font-semibold text-red-600">
              -{formatCurrency(monthlyExpenses)}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                netFlow >= 0 ? "bg-emerald-100" : "bg-red-100"
              )}
            >
              <Minus
                className={cn(
                  "h-4 w-4",
                  netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"
                )}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Neto</p>
            <p
              className={cn(
                "mt-1 font-semibold",
                netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"
              )}
            >
              {netFlow >= 0 ? "+" : ""}
              {formatCurrency(netFlow)}
            </p>
          </div>
        </div>
      </div>`;

const newSummary = `      {/* Summary Section */}
      <div className="px-6 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Resumen del mes</h2>
          <button className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Este mes</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/60 px-5 py-4 shadow-sm backdrop-blur-sm">
          {/* Ingresos */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10">
                <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Ingresos</p>
            </div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(monthlyIncome)}
            </p>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-border/50"></div>

          {/* Gastos */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10">
                <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Gastos</p>
            </div>
            <p className="font-semibold text-red-600 dark:text-red-400">
              -{formatCurrency(monthlyExpenses)}
            </p>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-border/50"></div>

          {/* Neto */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", netFlow > 0 ? "bg-emerald-500/10" : netFlow < 0 ? "bg-red-500/10" : "bg-muted")}>
                <Minus className={cn("h-3 w-3", netFlow > 0 ? "text-emerald-600 dark:text-emerald-400" : netFlow < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Neto</p>
            </div>
            <p className={cn("font-semibold", netFlow > 0 ? "text-emerald-600 dark:text-emerald-400" : netFlow < 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              {netFlow > 0 ? "+" : ""}{formatCurrency(netFlow)}
            </p>
          </div>
        </div>
      </div>`;

content = content.replace(oldSummary, newSummary);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated successfully");
