type EventPayload = {
  type: string
  payload?: any
}

type Listener = (event: EventPayload) => void

const listeners: Map<string, Set<Listener>> = new Map()

export const EventBus = {
  on(event: string, fn: Listener): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(fn)
    return () => {
      listeners.get(event)?.delete(fn)
    }
  },

  emit(event: EventPayload) {
    listeners.get(event.type)?.forEach((fn) => fn(event))
  },
}