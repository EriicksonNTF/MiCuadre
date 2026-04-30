type EventPayload = {
  type: string
  payload?: any
}

const listeners: Function[] = []

export const EventBus = {
  emit(event: EventPayload) {
    listeners.forEach((fn) => fn(event))
  },
  subscribe(fn: Function) {
    listeners.push(fn)
    return () => {
      // Unsubscribe function
      const index = listeners.indexOf(fn)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  },
}
