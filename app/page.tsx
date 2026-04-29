import { Header } from "@/components/dashboard/header"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { AccountsList } from "@/components/dashboard/accounts-list"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/dashboard/transactions-list"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 pb-28 pt-8">
        <Header />

        <div className="mt-10">
          <BalanceCard />
        </div>

        <div className="mt-8">
          <QuickActions />
        </div>

        <div className="mt-10">
          <AccountsList />
        </div>

        <div className="mt-10">
          <TransactionsList />
        </div>
      </div>
    </main>
  )
}
