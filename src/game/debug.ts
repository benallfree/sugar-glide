import * as THREE from 'three'

// Debug panel constants
const DEBUG_PANEL_WIDTH = 250 // Width in pixels
const DEBUG_PANEL_PADDING = 10 // Padding in pixels

/**
 * Create a debug panel with various game debugging features
 */
export const createDebugPanel = (scene: THREE.Scene) => {
  // Debug state
  let isPanelOpen = false
  let hideTrunk = false
  let treeTrunk: THREE.Object3D | null = null
  let panel: HTMLElement | null = null

  // Reference for trunk radius to identify it in the scene
  const TRUNK_RADIUS = 3 // Should match the trunk radius in world.ts

  // Create the debug panel DOM element
  const createPanel = () => {
    const panel = document.createElement('div')
    panel.id = 'debug-panel'
    panel.style.position = 'absolute'
    panel.style.top = '10px'
    panel.style.right = '10px'
    panel.style.width = `${DEBUG_PANEL_WIDTH}px`
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
    panel.style.color = 'white'
    panel.style.padding = `${DEBUG_PANEL_PADDING}px`
    panel.style.borderRadius = '5px'
    panel.style.fontFamily = 'monospace'
    panel.style.fontSize = '12px'
    panel.style.zIndex = '1000'
    panel.style.display = 'none'

    // Header
    const header = document.createElement('h3')
    header.textContent = 'Debug Panel'
    header.style.margin = '0 0 10px 0'
    header.style.borderBottom = '1px solid #666'
    header.style.paddingBottom = '5px'
    panel.appendChild(header)

    // Toggle for trunk visibility
    const trunkToggleContainer = document.createElement('div')
    trunkToggleContainer.style.margin = '10px 0'
    panel.appendChild(trunkToggleContainer)

    const trunkToggle = document.createElement('input')
    trunkToggle.type = 'checkbox'
    trunkToggle.id = 'trunk-toggle'
    trunkToggleContainer.appendChild(trunkToggle)

    const trunkLabel = document.createElement('label')
    trunkLabel.htmlFor = 'trunk-toggle'
    trunkLabel.textContent = ' Hide Tree Trunk'
    trunkLabel.style.marginLeft = '5px'
    trunkToggleContainer.appendChild(trunkLabel)

    trunkToggle.addEventListener('change', () => {
      hideTrunk = trunkToggle.checked
      updateTrunkVisibility()
    })

    document.body.appendChild(panel)
    return panel
  }

  // Remove debug panel from DOM
  const removePanel = () => {
    if (panel) {
      document.body.removeChild(panel)
      panel = null
    }
  }

  // Update panel visibility
  const updatePanelVisibility = () => {
    if (!panel && isPanelOpen) {
      panel = createPanel()
    }

    if (panel) {
      panel.style.display = isPanelOpen ? 'block' : 'none'
    }
  }

  // Update trunk visibility based on debug setting
  const updateTrunkVisibility = () => {
    if (!treeTrunk) {
      // Find the tree trunk in the scene
      scene.traverse((object) => {
        // Look for a cylinder that matches the trunk radius
        // This assumes the trunk is a mesh with a CylinderGeometry
        if (
          object instanceof THREE.Mesh &&
          object.geometry instanceof THREE.CylinderGeometry &&
          Math.abs(object.geometry.parameters.radiusTop - TRUNK_RADIUS) < 0.1
        ) {
          treeTrunk = object
        }
      })
    }

    if (treeTrunk) {
      treeTrunk.visible = !hideTrunk
    }
  }

  // Toggle panel visibility
  const togglePanel = () => {
    isPanelOpen = !isPanelOpen
    updatePanelVisibility()
  }

  // Setup keyboard event listener for debug panel
  const setupKeyboardEvents = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Toggle debug panel with comma key
      if (e.code === 'Comma' && !e.repeat) {
        togglePanel()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    // Return cleanup function
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }

  // Setup initial state
  const cleanupKeyboardEvents = setupKeyboardEvents()
  panel = createPanel() // Create but don't show

  return {
    togglePanel,
    isOpen: () => isPanelOpen,
    cleanup: () => {
      cleanupKeyboardEvents()
      removePanel()
    },
  }
}
