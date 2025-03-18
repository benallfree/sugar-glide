import * as THREE from 'three'

// Constants
const CLIMB_SPEED = 10 // Units per second
const ROTATION_SPEED = 3 // Radians per second
const TRUNK_RADIUS = 3 // Must match the tree trunk radius in world.ts

// Camera constants
const CAMERA_BASE_DISTANCE = 7 // Base distance from trunk
const CAMERA_MIN_HEIGHT = 2 // Minimum height offset
const CAMERA_MAX_HEIGHT = 5 // Maximum height offset
const CAMERA_FOV_DEFAULT = 75 // Default field of view
const CAMERA_FOV_MOVING = 85 // FOV when moving quickly
const CAMERA_SMOOTHING = 0.1 // Lower = smoother camera (0-1)
const CAMERA_PREDICTION_STRENGTH = 2.0 // How strongly camera predicts movement

/**
 * Create a squirrel player that can navigate on the tree trunk
 */
export const createSquirrel = (scene: THREE.Scene, camera: THREE.Camera) => {
  // State
  let position = new THREE.Vector3(TRUNK_RADIUS, 10, 0) // Start at 10 units up the trunk
  let rotation = new THREE.Euler(0, Math.PI / 2, 0) // Face tangent to trunk

  // Movement tracking for camera prediction
  let verticalVelocity = 0
  let rotationalVelocity = 0
  let lastPosition = position.clone()
  let lastAngle = Math.atan2(position.x, position.z)

  // Camera state
  let targetCameraPosition = new THREE.Vector3()
  let currentCameraDistance = CAMERA_BASE_DISTANCE
  let currentCameraHeight = CAMERA_MIN_HEIGHT
  let currentCameraFOV = CAMERA_FOV_DEFAULT

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
    // Store previous position for velocity calculation
    lastPosition.copy(position)
    const previousAngle = lastAngle

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
    lastAngle = angle

    // Keep squirrel stuck to trunk surface at all times
    position.x = TRUNK_RADIUS * Math.sin(angle)
    position.z = TRUNK_RADIUS * Math.cos(angle)

    // Update mesh position
    squirrel.position.copy(position)

    // Update rotation to face tangent to trunk (perpendicular to radius)
    squirrel.rotation.y = angle + Math.PI / 2

    // Calculate velocities for camera prediction
    verticalVelocity = (position.y - lastPosition.y) / deltaTime
    rotationalVelocity = (angle - previousAngle) / deltaTime

    // Calculate movement speed for camera adjustments
    const movementSpeed = Math.sqrt(
      verticalVelocity * verticalVelocity +
        rotationalVelocity * rotationalVelocity * TRUNK_RADIUS * TRUNK_RADIUS
    )

    // Update dynamic camera
    updateDynamicCamera(angle, deltaTime, movementSpeed)
  }

  // Enhanced dynamic camera that intelligently follows the squirrel
  const updateDynamicCamera = (angle: number, deltaTime: number, movementSpeed: number) => {
    // 1. Adjust camera height based on vertical velocity
    const targetHeight =
      CAMERA_MIN_HEIGHT +
      (Math.abs(verticalVelocity) / CLIMB_SPEED) * (CAMERA_MAX_HEIGHT - CAMERA_MIN_HEIGHT)

    currentCameraHeight = THREE.MathUtils.lerp(currentCameraHeight, targetHeight, CAMERA_SMOOTHING)

    // 2. Adjust camera distance based on movement speed
    const speedFactor = Math.min(movementSpeed / (CLIMB_SPEED + ROTATION_SPEED), 1)
    const targetDistance = CAMERA_BASE_DISTANCE * (1 + speedFactor * 0.3)

    currentCameraDistance = THREE.MathUtils.lerp(
      currentCameraDistance,
      targetDistance,
      CAMERA_SMOOTHING
    )

    // 3. Update FOV for dynamic feel during movement
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFOV = THREE.MathUtils.lerp(CAMERA_FOV_DEFAULT, CAMERA_FOV_MOVING, speedFactor)

      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, CAMERA_SMOOTHING)
      camera.updateProjectionMatrix()
    }

    // 4. Calculate base camera angle (opposite side of trunk from squirrel)
    let cameraAngle = angle + Math.PI

    // 5. Apply rotational prediction to see around the trunk during rotation
    if (Math.abs(rotationalVelocity) > 0.1) {
      // Adjust camera angle to lead the movement direction
      cameraAngle += rotationalVelocity * CAMERA_PREDICTION_STRENGTH * deltaTime
    }

    // 6. Calculate target camera position with prediction
    const predictedHeight = position.y + verticalVelocity * CAMERA_PREDICTION_STRENGTH * deltaTime

    targetCameraPosition.set(
      Math.sin(cameraAngle) * (TRUNK_RADIUS + currentCameraDistance),
      predictedHeight + currentCameraHeight,
      Math.cos(cameraAngle) * (TRUNK_RADIUS + currentCameraDistance)
    )

    // 7. Smoothly move camera toward target position
    if (!camera.position.equals(targetCameraPosition)) {
      camera.position.lerp(targetCameraPosition, CAMERA_SMOOTHING)
    }

    // 8. Look at the squirrel with slight vertical offset for better view
    const lookTarget = new THREE.Vector3(
      position.x,
      position.y + 0.5, // Look slightly above squirrel
      position.z
    )

    camera.lookAt(lookTarget)

    // 9. Dynamic tilt based on vertical velocity
    const tiltAmount =
      -0.2 - Math.sign(verticalVelocity) * Math.min(Math.abs(verticalVelocity) / CLIMB_SPEED, 0.2)
    camera.rotateX(tiltAmount)
  }

  // Setup controls and return cleanup function
  const cleanupControls = setupControls()

  return {
    squirrel,
    position,
    update: (deltaTime: number) => {
      updateSquirrel(deltaTime)
    },
    cleanup: () => {
      cleanupControls()
    },
  }
}
