import * as THREE from 'three'
import { Player } from '../player'
import createDebugArrows from './arrows'

// Debug panel constants
const DEBUG_PANEL_WIDTH = 250 // Width in pixels
const DEBUG_PANEL_PADDING = 10 // Padding in pixels
const STORAGE_KEY = 'sugar-glide-debug-settings' // Storage key for localStorage

/**
 * Create a debug panel with various game debugging features
 */
export const createDebugPanel = (scene: THREE.Scene, player: Player) => {
  // Debug state
  let isPanelOpen = false
  let hideTrunk = false
  let showCoordinates = false
  let treeTrunk: THREE.Object3D | null = null
  let panel: HTMLElement | null = null
  let wasInGameMode = false // Track if we were in game mode before opening panel

  // Create debug arrows
  const arrows = createDebugArrows(scene)

  // Reference for trunk radius to identify it in the scene
  const TRUNK_RADIUS = 3 // Should match the trunk radius in world.ts

  // Pointer lock management
  const exitGameMode = () => {
    if (document.pointerLockElement) {
      wasInGameMode = true
      document.exitPointerLock()
    }
  }

  const restoreGameMode = () => {
    if (wasInGameMode) {
      const gameContainer = document.getElementById('game-container')
      if (gameContainer) {
        gameContainer.requestPointerLock()
      }
      wasInGameMode = false
    }
  }

  // Load saved debug settings from localStorage
  const loadDebugSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY)
      if (!savedSettings) return

      const settings = JSON.parse(savedSettings)
      isPanelOpen = settings.isPanelOpen ?? false
      hideTrunk = settings.hideTrunk ?? false
      showCoordinates = settings.showCoordinates ?? false
    } catch (error) {
      console.error('Failed to load debug settings:', error)
    }
  }

  // Save current debug settings to localStorage
  const saveDebugSettings = () => {
    try {
      const settings = {
        isPanelOpen,
        hideTrunk,
        showCoordinates,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save debug settings:', error)
    }
  }

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
    trunkToggle.checked = hideTrunk
    trunkToggleContainer.appendChild(trunkToggle)

    const trunkLabel = document.createElement('label')
    trunkLabel.htmlFor = 'trunk-toggle'
    trunkLabel.textContent = ' Hide Tree Trunk'
    trunkLabel.style.marginLeft = '5px'
    trunkToggleContainer.appendChild(trunkLabel)

    trunkToggle.addEventListener('change', () => {
      hideTrunk = trunkToggle.checked
      updateTrunkVisibility()
      saveDebugSettings()
    })

    // Toggle for coordinate system visualization
    const coordToggleContainer = document.createElement('div')
    coordToggleContainer.style.margin = '10px 0'
    panel.appendChild(coordToggleContainer)

    const coordToggle = document.createElement('input')
    coordToggle.type = 'checkbox'
    coordToggle.id = 'coord-toggle'
    coordToggle.checked = showCoordinates
    coordToggleContainer.appendChild(coordToggle)

    const coordLabel = document.createElement('label')
    coordLabel.htmlFor = 'coord-toggle'
    coordLabel.textContent = ' Show Coordinate System'
    coordLabel.style.marginLeft = '5px'
    coordToggleContainer.appendChild(coordLabel)

    coordToggle.addEventListener('change', () => {
      showCoordinates = coordToggle.checked
      updateCoordinateVisibility()
      saveDebugSettings()
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

      // Handle pointer lock based on panel state
      if (isPanelOpen) {
        exitGameMode()
      } else {
        restoreGameMode()
      }
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

  // Update coordinate system visibility
  const updateCoordinateVisibility = () => {
    arrows.setArrowsVisible(showCoordinates)
  }

  // Toggle panel visibility
  const togglePanel = () => {
    isPanelOpen = !isPanelOpen
    updatePanelVisibility()
    saveDebugSettings() // Save changes to localStorage
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

  // Load saved settings and setup initial state
  loadDebugSettings()
  const cleanupKeyboardEvents = setupKeyboardEvents()
  panel = createPanel() // Create panel
  updatePanelVisibility() // Set visibility based on loaded settings
  updateTrunkVisibility() // Apply trunk visibility setting
  updateCoordinateVisibility() // Apply coordinate system visibility setting

  // Update function to be called in animation loop
  const update = () => {
    if (showCoordinates) {
      const { meshPosition, normal, up, forward } = player.getOrientationVectors()
      arrows.updateArrows(meshPosition, normal, up, forward)
    }
  }

  return {
    togglePanel,
    isOpen: () => isPanelOpen,
    update,
    cleanup: () => {
      cleanupKeyboardEvents()
      removePanel()
      arrows.cleanup()
    },
  }
}
