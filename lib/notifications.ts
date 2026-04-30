export const NOTIFICATIONS_DEBUG = true

export function notify({ title, message }: { title: string; message: string }) {
  if (NOTIFICATIONS_DEBUG) {
    console.log("🔔", title, message)
  }
  
  // En un entorno de producción, aquí podrías usar un toast (ej. react-hot-toast o sonner)
  // Por ahora lo simplificamos según el requerimiento.
  if (typeof window !== "undefined") {
    // avoid native alert blockings in rapid succession if possible, 
    // but the prompt specifies using alert for MVP
    alert(`${title}\n${message}`)
  }
}
