import { createKeyboardController } from './KeyboardController'
import { MovementController } from './MovementController'
import { createTouchController } from './TouchController'

export const createInputController = (): MovementController => {
  // Check if device supports touch
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  if (isTouchDevice) {
    return createTouchController()
  }

  return createKeyboardController()
}
