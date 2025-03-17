import * as THREE from 'three'

// Constants
const CLIMB_SPEED = 10 // Units per second
const ROTATION_SPEED = 3 // Radians per second
const TRUNK_RADIUS = 3 // Must match the tree trunk radius in world.ts

/**
 * Create a squirrel player that can navigate on the tree trunk
 */
export const createSquirrel = (scene: THREE.Scene, camera: THREE.Camera) => {
  // State
  let position = new THREE.Vector3(TRUNK_RADIUS, 10, 0) // Start at 10 units up the trunk
  let rotation = new THREE.Euler(0, Math.PI / 2, 0) // Face tangent to trunk

  // Create squirrel mesh
  const squirrel = createSquirrelMesh()
  squirrel.position.copy(position)
  squirrel.rotation.copy(rotation)
  scene.add(squirrel)

  // Movement controls
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  // Setup keyboard controls
  const setupControls = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.up = true
          break
        case 'ArrowDown':
        case 'KeyS':
          keys.down = true
          break
        case 'ArrowLeft':
        case 'KeyA':
          keys.left = true
          break
        case 'ArrowRight':
        case 'KeyD':
          keys.right = true
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keys.up = false
          break
        case 'ArrowDown':
        case 'KeyS':
          keys.down = false
          break
        case 'ArrowLeft':
        case 'KeyA':
          keys.left = false
          break
        case 'ArrowRight':
        case 'KeyD':
          keys.right = false
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Return cleanup function
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }

  // Create squirrel model using simple shapes
  function createSquirrelMesh() {
    const group = new THREE.Group()

    // Body
    const bodyGeometry = new THREE.SphereGeometry(0.5, 12, 8)
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 }) // Brown
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.scale.set(0.8, 1, 0.8)
    group.add(body)

    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 8, 8)
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.set(0, 0.4, 0.4)
    group.add(head)

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 6, 6)
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 })

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    leftEye.position.set(-0.1, 0.5, 0.6)
    group.add(leftEye)

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    rightEye.position.set(0.1, 0.5, 0.6)
    group.add(rightEye)

    // Tail
    const tailGeometry = new THREE.CylinderGeometry(0.1, 0.2, 0.8, 6)
    const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    const tail = new THREE.Mesh(tailGeometry, tailMaterial)
    tail.position.set(0, 0, -0.6)
    tail.rotation.x = Math.PI / 3
    group.add(tail)

    // Rotate to face outward from trunk
    group.rotation.y = Math.PI / 2

    return group
  }

  // Update the squirrel position
  const updateSquirrel = (deltaTime: number) => {
    // Vertical movement (up/down the trunk)
    if (keys.up) {
      position.y += CLIMB_SPEED * deltaTime
    }
    if (keys.down) {
      position.y -= CLIMB_SPEED * deltaTime
      // Prevent going below ground
      if (position.y < 1) {
        position.y = 1
      }
    }

    // Rotational movement (around the trunk)
    let angle = Math.atan2(position.x, position.z)
    if (keys.left) {
      angle += ROTATION_SPEED * deltaTime
    }
    if (keys.right) {
      angle -= ROTATION_SPEED * deltaTime
    }

    // Keep squirrel stuck to trunk surface at all times
    position.x = TRUNK_RADIUS * Math.sin(angle)
    position.z = TRUNK_RADIUS * Math.cos(angle)

    // Update mesh position
    squirrel.position.copy(position)

    // Update rotation to face tangent to trunk (perpendicular to radius)
    squirrel.rotation.y = angle + Math.PI / 2

    // Update camera to follow squirrel
    updateCamera(angle)
  }

  // Update camera to follow the squirrel
  const updateCamera = (angle: number) => {
    // Position camera behind squirrel
    const cameraDistance = 7
    const cameraHeight = 3
    const cameraAngle = angle + Math.PI // Opposite side of trunk from squirrel

    camera.position.set(
      Math.sin(cameraAngle) * (TRUNK_RADIUS + cameraDistance),
      position.y + cameraHeight,
      Math.cos(cameraAngle) * (TRUNK_RADIUS + cameraDistance)
    )

    // Look at the squirrel
    camera.lookAt(squirrel.position)

    // Tilt camera down slightly
    camera.rotateX(-0.2)
  }

  // Setup controls and return cleanup function
  const cleanupControls = setupControls()

  return {
    squirrel,
    position,
    update: updateSquirrel,
    cleanup: cleanupControls,
  }
}
