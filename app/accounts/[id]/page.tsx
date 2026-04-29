import { AccountDetail } from "@/components/accounts/account-detail"

interface AccountPageProps {
  params: Promise<{ id: string }>
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { id } = await params
  return <AccountDetail accountId={id} />
}
