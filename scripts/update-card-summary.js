const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/accounts/account-detail.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldSummary = `        {isCredit && account.creditLimit && (
          <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/85 p-4 text-sm text-foreground">
                <p className="font-semibold">Resumen de tarjeta</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Limite DOP</p>
                  <p className="font-semibold">{formatCurrency(Number(account.creditLimitDop || 0), "DOP")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Disponible: {formatCurrency(Number(account.available_credit_dop || Number(account.creditLimitDop || 0) - Number(account.currentDebtDop || 0)), "DOP")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Balance actual: {formatCurrency(Number(account.currentDebtDop || 0), "DOP")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Balance al corte: {formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)), "DOP")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Pago mínimo: {formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "DOP")}</p>
                </div>
                {hasUsdOnCard && <div className="rounded-xl bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Limite USD</p>
                  <p className="font-semibold">{formatCurrency(Number(account.creditLimitUsd || 0), "USD")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Disponible: {formatCurrency(Number(account.available_credit_usd || Number(account.creditLimitUsd || 0) - Number(account.currentDebtUsd || 0)), "USD")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Balance actual: {formatCurrency(Number(account.currentDebtUsd || 0), "USD")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Balance al corte: {formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)), "USD")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Pago mínimo: {formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "USD")}</p>
                </div>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Pagar antes de: {account.statementDueDate ? formatDate(account.statementDueDate) : "-"}</p>
            </div>
            
            {/* Pay button */}
            <Button
              onClick={() => setShowPayment(true)}
              className="h-12 w-full rounded-2xl bg-white/85 text-foreground hover:bg-white"
            >
              Pagar tarjeta
            </Button>
          </div>
        )}`;

const newSummary = `        {isCredit && account.creditLimit && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-sm backdrop-blur-md text-white">
              <h3 className="text-sm font-medium text-white/80">Resumen de tarjeta</h3>
              
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* DOP Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <p className="text-xs font-medium text-white/70">Límite DOP</p>
                    <p className="text-lg font-bold">{formatCurrency(Number(account.creditLimitDop || 0), "DOP")}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/60">Disponible</p>
                      <p className="font-semibold text-white mt-0.5">{formatCurrency(Number(account.available_credit_dop || Number(account.creditLimitDop || 0) - Number(account.currentDebtDop || 0)), "DOP")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Balance actual</p>
                      <p className="font-semibold text-white mt-0.5">{formatCurrency(Number(account.currentDebtDop || 0), "DOP")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Al corte</p>
                      <p className="font-semibold text-white mt-0.5">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)), "DOP")}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Pago mínimo</p>
                      <p className="font-semibold text-white mt-0.5">{formatCurrency(Math.max(0, Number(account.statementDop || 0) - Number(account.paidStatementDop || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "DOP")}</p>
                    </div>
                  </div>
                </div>

                {/* USD Card (if exists) */}
                {hasUsdOnCard && (
                  <div className="space-y-3 sm:border-l sm:border-white/10 sm:pl-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <p className="text-xs font-medium text-white/70">Límite USD</p>
                      <p className="text-lg font-bold">{formatCurrency(Number(account.creditLimitUsd || 0), "USD")}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-white/60">Disponible</p>
                        <p className="font-semibold text-white mt-0.5">{formatCurrency(Number(account.available_credit_usd || Number(account.creditLimitUsd || 0) - Number(account.currentDebtUsd || 0)), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Balance actual</p>
                        <p className="font-semibold text-white mt-0.5">{formatCurrency(Number(account.currentDebtUsd || 0), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Al corte</p>
                        <p className="font-semibold text-white mt-0.5">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)), "USD")}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Pago mínimo</p>
                        <p className="font-semibold text-white mt-0.5">{formatCurrency(Math.max(0, Number(account.statementUsd || 0) - Number(account.paidStatementUsd || 0)) * Number(account.minimumPaymentPercentage || 0.0278), "USD")}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-white/60" />
                <p className="text-xs text-white/80">Pagar antes de: <span className="font-medium text-white">{account.statementDueDate ? formatDate(account.statementDueDate) : "-"}</span></p>
              </div>
            </div>
            
            {/* Pay button */}
            <Button
              onClick={() => setShowPayment(true)}
              className="h-12 w-full rounded-2xl bg-white text-zinc-900 font-semibold shadow-md active:scale-[0.98] transition-all hover:bg-white/90"
            >
              Pagar tarjeta
            </Button>
          </div>
        )}`;

content = content.replace(oldSummary, newSummary);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated successfully");
