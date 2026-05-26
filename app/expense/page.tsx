"use client"

import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ExpenseForm } from "@/components/expense/expense-form"

function ExpensePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const prefill = {
    amount: searchParams.get("amount") || "",
    description: searchParams.get("description") || "",
    currency: (searchParams.get("currency") as "DOP" | "USD" | null) || null,
    date: searchParams.get("date") || "",
    categoryName: searchParams.get("category") || "",
  }

  return <ExpenseForm onBack={() => router.push("/history")} prefill={prefill} />
}

export default function ExpensePage() {
  return (
    <Suspense fallback={<ExpenseForm />}>
      <ExpensePageContent />
    </Suspense>
  )
}
