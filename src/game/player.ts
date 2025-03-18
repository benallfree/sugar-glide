import * as THREE from 'three'
import { MovementState } from './input/MovementController'

// Constants
const CLIMB_SPEED = 10 // Units per second
const ROTATION_SPEED = 3 // Radians per second
const TRUNK_RADIUS = 3 // Must match the tree trunk radius in world.ts
const MOVEMENT_SPEED = 8 // Units per second for general movement
const TURN_SPEED = 4 // Radians per second for in-place rotation
const SQUIRREL_BODY_OFFSET = 0.4 // Distance to offset squirrel from trunk surface

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
  let trunkAngle = Math.atan2(position.x, position.z) // Angle around trunk
  let orientationAngle = 0 // Angle relative to trunk surface (0 = up, PI/2 = clockwise around trunk)
  let rotation = new THREE.Euler(0, Math.PI / 2, 0) // Face tangent to trunk

  // Movement state
  let movementState: MovementState = {
    up: false,
    down: false,
    left: false,
    right: false,
  }

  // Debug helpers
  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    1,
    0xff0000
  )
  const upArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(),
    1,
    0x00ff00
  )
  const forwardArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(),
    1,
    0x0000ff
  )

  // Hide arrows by default
  normalArrow.visible = false
  upArrow.visible = false
  forwardArrow.visible = false

  scene.add(normalArrow)
  scene.add(upArrow)
  scene.add(forwardArrow)

  // Movement tracking for camera prediction
  let velocity = new THREE.Vector3()
  let lastPosition = position.clone()
  let lastTrunkAngle = trunkAngle

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

  // Calculate bounding box for the squirrel model
  const boundingBox = new THREE.Box3().setFromObject(squirrel)
  const squirrelHeight = boundingBox.max.y - boundingBox.min.y
  const bottomOffset = -boundingBox.min.y // Distance from origin to bottom of model

  // Update the squirrel position
  const updateSquirrel = (deltaTime: number) => {
    // Store previous position for velocity calculation
    lastPosition.copy(position)
    const previousTrunkAngle = lastTrunkAngle

    // Handle rotation (left/right input)
    if (movementState.left) {
      orientationAngle += TURN_SPEED * deltaTime
    }
    if (movementState.right) {
      orientationAngle -= TURN_SPEED * deltaTime
    }

    // Forward movement (up input)
    if (movementState.up) {
      // Decompose movement into vertical and circumferential components
      const verticalComponent = Math.cos(orientationAngle) * MOVEMENT_SPEED * deltaTime
      const circumferentialComponent = Math.sin(orientationAngle) * MOVEMENT_SPEED * deltaTime

      // Apply vertical movement
      position.y += verticalComponent

      // Apply circumferential movement
      trunkAngle += circumferentialComponent / TRUNK_RADIUS

      // Prevent going below ground
      if (position.y < bottomOffset) {
        position.y = bottomOffset
      }
    }

    // Calculate basis vectors for squirrel's local coordinate system
    // 1. Normal vector (points outward from trunk)
    const normal = new THREE.Vector3(Math.sin(trunkAngle), 0, Math.cos(trunkAngle)).normalize()

    // 2. Up vector (tangent to trunk, pointing "up")
    const up = new THREE.Vector3(0, 1, 0)

    // 3. Forward vector (direction squirrel is facing, based on orientation)
    const forward = new THREE.Vector3()
    forward.crossVectors(up, normal) // Start with vector tangent to trunk

    // Create rotation matrix from these basis vectors
    const rotationMatrix = new THREE.Matrix4()

    // Rotate forward vector by orientation angle around normal
    const orientationMatrix = new THREE.Matrix4()
    orientationMatrix.makeRotationAxis(normal, orientationAngle)
    forward.applyMatrix4(orientationMatrix)

    // Recalculate up vector to ensure orthogonal basis
    up.crossVectors(forward, normal)
    up.normalize()

    // Construct rotation matrix from orthogonal vectors
    rotationMatrix.makeBasis(forward, up, normal)

    // Update position on trunk surface
    position.x = TRUNK_RADIUS * Math.sin(trunkAngle)
    position.z = TRUNK_RADIUS * Math.cos(trunkAngle)

    // Position mesh with feet on trunk surface
    const meshPosition = position.clone().add(normal.multiplyScalar(bottomOffset))

    // Update mesh position and rotation
    squirrel.position.copy(meshPosition)
    squirrel.rotation.setFromRotationMatrix(rotationMatrix)

    // Calculate velocities for camera prediction
    velocity.subVectors(position, lastPosition).divideScalar(deltaTime)
    lastTrunkAngle = trunkAngle

    // Calculate movement speed for camera adjustments
    const movementSpeed = velocity.length()

    // Update dynamic camera
    updateDynamicCamera(trunkAngle, deltaTime, movementSpeed)

    // Update debug arrows
    normalArrow.position.copy(meshPosition)
    upArrow.position.copy(meshPosition)
    forwardArrow.position.copy(meshPosition)

    normalArrow.setDirection(normal)
    upArrow.setDirection(up)
    forwardArrow.setDirection(forward)
  }

  // Enhanced dynamic camera that intelligently follows the squirrel
  const updateDynamicCamera = (trunkAngle: number, deltaTime: number, movementSpeed: number) => {
    // 1. Adjust camera height based on vertical velocity
    const targetHeight =
      CAMERA_MIN_HEIGHT +
      (Math.abs(velocity.y) / CLIMB_SPEED) * (CAMERA_MAX_HEIGHT - CAMERA_MIN_HEIGHT)

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
    let cameraAngle = trunkAngle + Math.PI

    // 5. Apply rotational prediction to see around the trunk during rotation
    if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1) {
      // Adjust camera angle to lead the movement direction
      cameraAngle += Math.atan2(velocity.x, velocity.z) * CAMERA_PREDICTION_STRENGTH * deltaTime
    }

    // 6. Calculate target camera position with prediction
    const predictedHeight = position.y + velocity.y * CAMERA_PREDICTION_STRENGTH * deltaTime

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
      -0.2 - Math.sign(velocity.y) * Math.min(Math.abs(velocity.y) / CLIMB_SPEED, 0.2)
    camera.rotateX(tiltAmount)
  }

  return {
    squirrel,
    position,
    update: (deltaTime: number) => {
      updateSquirrel(deltaTime)
    },
    cleanup: () => {
      // Clean up debug helpers
      scene.remove(normalArrow)
      scene.remove(upArrow)
      scene.remove(forwardArrow)
    },
    handleMovement: (state: MovementState) => {
      movementState = { ...state }
    },
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

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6)
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })

  // Front right leg
  const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial)
  frontRightLeg.position.set(0.2, -0.4, 0.2)
  frontRightLeg.rotation.x = Math.PI / 6
  group.add(frontRightLeg)

  // Front left leg
  const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial)
  frontLeftLeg.position.set(-0.2, -0.4, 0.2)
  frontLeftLeg.rotation.x = Math.PI / 6
  group.add(frontLeftLeg)

  // Back right leg
  const backRightLeg = new THREE.Mesh(legGeometry, legMaterial)
  backRightLeg.position.set(0.2, -0.4, -0.2)
  backRightLeg.rotation.x = -Math.PI / 6
  group.add(backRightLeg)

  // Back left leg
  const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial)
  backLeftLeg.position.set(-0.2, -0.4, -0.2)
  backLeftLeg.rotation.x = -Math.PI / 6
  group.add(backLeftLeg)

  group.rotation.y = Math.PI / 2

  return group
}
