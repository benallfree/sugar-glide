import { MovementController, MovementState, createMovementController } from './MovementController'

export const createTouchController = (): MovementController => {
  const controller = createMovementController()
  const state: MovementState = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  // Touch state tracking
  let touchStartX = 0
  let touchStartY = 0
  const TOUCH_THRESHOLD = 30 // Minimum distance to trigger movement

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY

      // Start moving forward immediately on touch
      state.up = true
      controller.notify(state)
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStartX

      // Reset left/right state
      state.left = false
      state.right = false

      // Update left/right based on horizontal movement
      if (Math.abs(deltaX) > TOUCH_THRESHOLD) {
        if (deltaX > 0) {
          state.right = true
        } else {
          state.left = true
        }
      }

      controller.notify(state)
    }
  }

  const handleTouchEnd = () => {
    // Reset all state when touch ends
    state.up = false
    state.down = false
    state.left = false
    state.right = false
    controller.notify(state)
  }

  window.addEventListener('touchstart', handleTouchStart)
  window.addEventListener('touchmove', handleTouchMove)
  window.addEventListener('touchend', handleTouchEnd)
  window.addEventListener('touchcancel', handleTouchEnd)

  const originalCleanup = controller.cleanup
  controller.cleanup = () => {
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchEnd)
    originalCleanup()
  }

  return controller
}
