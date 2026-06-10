import { Suspense } from "react"
import { AccountDetailPage } from "./account-page"

export function generateStaticParams() {
  return [{ id: "placeholder" }]
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountDetailPage />
    </Suspense>
  )
}
