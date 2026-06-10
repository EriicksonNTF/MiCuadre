"use client"

import { useParams } from "next/navigation"
import { AccountDetail } from "@/components/accounts/account-detail"

export function AccountDetailPage() {
  const params = useParams()
  const id = params.id as string
  return <AccountDetail accountId={id} />
}
