import { redirect } from "next/navigation"

export default function LoginRoutePage() {
  redirect("/auth/login")
}
