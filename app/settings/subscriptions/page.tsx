import { SubscriptionsScreen } from "@/components/settings/subscriptions-screen"

export default async function SettingsSubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ create?: string }>
}) {
  const resolved = (await searchParams) || {}
  return <SubscriptionsScreen initialOpenCreate={resolved.create === "1"} />
}
