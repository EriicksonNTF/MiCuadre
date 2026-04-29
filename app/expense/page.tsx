"use client"

import { useRouter } from "next/navigation"
import { ExpenseForm } from "@/components/expense/expense-form"

export default function ExpensePage() {
  const router = useRouter()

  return <ExpenseForm onBack={() => router.push("/")} />
}
