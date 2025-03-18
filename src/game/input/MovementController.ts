export type MovementState = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export type MovementHandler = (state: MovementState) => void

export interface MovementController {
  subscribe: (handler: MovementHandler) => () => void
  notify: (state: MovementState) => void
  cleanup: () => void
}

export const createMovementController = (): MovementController => {
  const handlers = new Set<MovementHandler>()
  const state: MovementState = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  return {
    subscribe: (handler: MovementHandler) => {
      handlers.add(handler)
      // Return unsubscribe function
      return () => handlers.delete(handler)
    },
    notify: (state: MovementState) => {
      handlers.forEach((handler) => handler(state))
    },
    cleanup: () => {
      handlers.clear()
    },
  }
}
