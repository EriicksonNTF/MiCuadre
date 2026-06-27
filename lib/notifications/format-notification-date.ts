export function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", hour12: true })
}

export function formatNotificationDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.floor((startNow.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const time = formatNotificationTime(value)

  if (diff === 0) return `Hoy · ${time}`
  if (diff === 1) return `Ayer · ${time}`

  const prettyDate = date.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })
  return `${prettyDate} · ${time}`
}
