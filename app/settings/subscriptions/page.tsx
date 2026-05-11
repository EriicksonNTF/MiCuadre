import { SubscriptionsScreen } from "@/components/settings/subscriptions-screen"

export default function SettingsSubscriptionsPage({
  searchParams,
}: {
  searchParams?: { create?: string }
}) {
  return <SubscriptionsScreen initialOpenCreate={searchParams?.create === "1"} />
}
