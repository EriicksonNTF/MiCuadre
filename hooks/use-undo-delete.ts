import { useCallback } from "react"
import { notify } from "@/lib/notifications"

export function useUndoDelete() {
  const deleteWithUndo = useCallback(async (
    _transactionId: string,
    deleteFn: () => Promise<unknown>,
  ) => {
    await deleteFn()
    notify({ title: "Transacción eliminada exitosamente." })
  }, [])

  const undo = useCallback(async () => {
    // No-op: undo was removed in favor of simple toast confirmations
  }, [])

  return { pending: null, deleteWithUndo, undo }
}
