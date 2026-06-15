import { useCallback, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type UndoDeleteItem = {
  transactionId: string
  expireAt: number
  count: number
}

export function useUndoDelete(onRestored?: () => void) {
  const [pending, setPending] = useState<UndoDeleteItem | null>(null)
  const timerRef = useRef<number | null>(null)
  const supabaseRef = useRef(createClient())

  const deleteWithUndo = useCallback(async (
    transactionId: string,
    deleteFn: () => Promise<unknown>,
  ) => {
    await deleteFn()
    const expireAt = Date.now() + 10000
    setPending({ transactionId, expireAt, count: 10 })

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setPending((prev) => {
        if (!prev) return null
        const remaining = Math.max(0, Math.ceil((prev.expireAt - Date.now()) / 1000))
        if (remaining <= 0) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          return null
        }
        return { ...prev, count: remaining }
      })
    }, 1000)
  }, [])

  const undo = useCallback(async () => {
    if (!pending) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    const id = pending.transactionId
    const supabase = supabaseRef.current
    setPending(null)
    await supabase.rpc("undelete_transaction_safe", { p_transaction_id: id })
    onRestored?.()
  }, [pending, onRestored])

  return { pending, deleteWithUndo, undo }
}
