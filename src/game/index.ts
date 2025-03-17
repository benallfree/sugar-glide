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

  // Animation loop
  let animationFrameId: number | null = null

  // Start animation loop
  const animate = () => {
    // Update controls
    controls.update()

    // Render scene
    renderer.render(scene, camera)

    // Continue animation loop
    animationFrameId = requestAnimationFrame(animate)
  }

  // Start the animation
  animate()

  // Create cleanup function
  const cleanup = () => {
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
    cleanup,
  }
}
