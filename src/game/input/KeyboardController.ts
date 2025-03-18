import { MovementController, MovementState, createMovementController } from './MovementController'

export const createKeyboardController = (): MovementController => {
  const controller = createMovementController()
  const state: MovementState = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  const notifyStateChange = () => {
    // Create a copy of the state to avoid mutation issues
    const stateCopy = { ...state }
    controller.notify(stateCopy)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    let changed = false

    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (!state.up) {
          state.up = true
          changed = true
        }
        break
      case 'ArrowDown':
      case 'KeyS':
        if (!state.down) {
          state.down = true
          changed = true
        }
        break
      case 'ArrowLeft':
      case 'KeyA':
        if (!state.left) {
          state.left = true
          changed = true
        }
        break
      case 'ArrowRight':
      case 'KeyD':
        if (!state.right) {
          state.right = true
          changed = true
        }
        break
    }

    if (changed) {
      notifyStateChange()
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    let changed = false

    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (state.up) {
          state.up = false
          changed = true
        }
        break
      case 'ArrowDown':
      case 'KeyS':
        if (state.down) {
          state.down = false
          changed = true
        }
        break
      case 'ArrowLeft':
      case 'KeyA':
        if (state.left) {
          state.left = false
          changed = true
        }
        break
      case 'ArrowRight':
      case 'KeyD':
        if (state.right) {
          state.right = false
          changed = true
        }
        break
    }

    if (changed) {
      notifyStateChange()
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const originalCleanup = controller.cleanup
  controller.cleanup = () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    originalCleanup()
  }

  return controller
}
