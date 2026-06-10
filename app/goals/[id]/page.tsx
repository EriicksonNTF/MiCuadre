import { GoalRedirectPage } from "./redirect-page"

export default function GoalDetailPage() {
  return <GoalRedirectPage />
}

export function generateStaticParams() {
  return [{ id: "placeholder" }]
}
