import { createDebugPanel } from './debug'
import { createInputController } from './input/createInputController'
import { createSquirrel } from './player'
import { createScene } from './scene'
import { createWorld } from './world'

/**
 * Create and initialize the game
 */
export const createGame = (containerId: string) => {
  // Get container element
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`Container element ${containerId} not found`)
    return null
  }

  // Setup scene
  const { scene, camera, renderer, controls } = createScene(container)

  // Create world (ground and tree trunk)
  const { ground, trunk, sky } = createWorld(scene)

  // Create squirrel player
  const player = createSquirrel(scene, camera)

  // Create and setup input controller
  const inputController = createInputController()
  const unsubscribeInput = inputController.subscribe(player.handleMovement)

  // Create debug panel
  const debugPanel = createDebugPanel(scene)

  // Disable orbit controls since we're using character-based camera
  controls.enabled = false

  // Track time for animation
  let lastTime = 0

  // Animation loop
  let animationFrameId: number | null = null

  // Start animation loop
  const animate = (time: number) => {
    // Calculate delta time in seconds
    const deltaTime = (time - lastTime) / 1000
    lastTime = time

    // Update squirrel with delta time (capped to prevent large jumps after tab switch)
    player.update(Math.min(deltaTime, 0.1))

    // Render scene
    renderer.render(scene, camera)

    // Continue animation loop
    animationFrameId = requestAnimationFrame(animate)
  }

  // Start the animation
  animationFrameId = requestAnimationFrame(animate)

  // Create cleanup function
  const cleanup = () => {
    // Clean up input controller
    unsubscribeInput()
    inputController.cleanup()

    // Clean up player controls
    player.cleanup()

    // Clean up debug panel
    debugPanel.cleanup()

    // Cancel animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }

    // Remove renderer from DOM
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }

    // Remove event listeners
    window.removeEventListener('resize', () => {})

    // Dispose of resources
    renderer.dispose()
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    world: { ground, trunk, sky },
    player,
    debugPanel,
    cleanup,
  }
}
