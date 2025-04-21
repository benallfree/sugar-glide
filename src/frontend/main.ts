import { io, Socket } from 'socket.io-client'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { Socket_PlayerData } from '../shared/types'
import { audio } from './audio'
import { createBabySystem } from './babies'
import { createBerry } from './berry'
import { createVibeCommands } from './command'
import {
  BERRY_SPAWN_INTERVAL,
  CAMERA_PLAYER_OFFSET,
  GROUND_HEIGHT_THRESHOLD,
  LOCAL_PLAYER_ID,
  NEAR_TREE_EPSILON,
  NORMAL_FOV,
} from './constants'
import { emitPlayerIdentityChanged } from './events'
import { generateForest } from './forest-generator'
import { createStatusBarWithState, updateStatusBarItem } from './status-bar'
import { createStore, WING_UPGRADES } from './store'
import { isNearTree, renderTree, replenishBerries, trees } from './tree'
import { PlayerData, PlayerMesh } from './types'
import { ui } from './ui'

const localPlayerId = (() => {
  let id = LOCAL_PLAYER_ID

  return (_id?: string) => {
    if (_id) {
      const oldId = id
      id = _id
      emitPlayerIdentityChanged(oldId, id)
    }
    return id
  }
})()

function updateVitality(value: number) {
  vitality = value
  updateStatusBarItem('vitality-count', Math.floor(value))
}

const splashScreen = document.getElementById('splash-screen') as HTMLDivElement
const startButton = document.getElementById('start-game') as HTMLButtonElement

startButton.addEventListener('click', () => {
  audio.playBackgroundMusic()
  splashScreen.classList.add('hidden')
  lockPointer()

  // Connect to the server when play button is pressed
  socket = io('/')

  // Set up socket event handlers
  setupSocketEvents()
})

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)

const povCamera = new THREE.PerspectiveCamera(
  NORMAL_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const chaseCamera = new THREE.PerspectiveCamera(
  NORMAL_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

let activeCamera: THREE.PerspectiveCamera = povCamera
povCamera.position.set(0, 2, 10)
povCamera.lookAt(0, 2, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)

try {
  document.body.appendChild(renderer.domElement)
} catch (error) {
  console.error('Error initializing renderer:', error)
  document.body.innerHTML =
    'Error: Could not initialize WebGL renderer. Please check your browser settings.'
}

import { GROUND_SIZE } from '../shared/constants'

// Create ground plane using shared size constant
const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE)
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 })
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// Add atmospheric fog and sky color
scene.fog = new THREE.FogExp2(0xcce0ff, 0.008)
scene.background = new THREE.Color(0xcce0ff)

// Set up atmospheric lighting
const ambientLight = new THREE.AmbientLight(0x6688cc, 0.5) // Blueish ambient light
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)

// Add a secondary fill light for better tree illumination
const fillLight = new THREE.HemisphereLight(0xffffff, 0x228b22, 0.3)
scene.add(fillLight)

let berries: number = 0
let wingLevel: number = 1

function updateBerryCount(count: number) {
  berries = count
  updateStatusBarItem('berry-count', count)
}

function updateWingDisplay(): void {
  updateStatusBarItem('wing-level', wingLevel)
}

updateWingDisplay()

let lastBerrySpawnTime: number = Date.now()

// Camera look control variables
let isLooking = false
let lookX = 0
let lookY = 0

let socket: Socket
const otherPlayers: Map<string, PlayerMesh> = new Map()

const localPlayerModel: PlayerMesh = createPlayerMesh()
localPlayerModel.position.set(0, 0, 0)
scene.add(localPlayerModel)

function createPlayerMesh(): PlayerMesh {
  const playerGroup = new THREE.Group() as PlayerMesh
  const color = new THREE.Color(
    Math.random() * 0.3 + 0.7,
    Math.random() * 0.3 + 0.7,
    Math.random() * 0.3 + 0.7
  )

  playerGroup.userData = {
    membranes: [],
  }

  // Create debug sphere for player collision
  const debugMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  })
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.25), // Player radius
    debugMaterial
  )
  debugSphere.position.y = 0.5 // Match body position
  playerGroup.add(debugSphere)

  // Create body
  const bodyGeometry = new THREE.SphereGeometry(0.4, 16, 12)
  bodyGeometry.scale(1, 0.5, 0.8)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.5
  playerGroup.add(body)

  // Create head
  const headGeometry = new THREE.SphereGeometry(0.25, 12, 12)
  const headMaterial = new THREE.MeshStandardMaterial({ color })
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.y = 0.7
  head.position.z = 0.2
  playerGroup.add(head)

  // Create eyes
  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8)
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 })
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  leftEye.position.set(0.15, 0.75, 0.4)
  rightEye.position.set(-0.15, 0.75, 0.4)
  playerGroup.add(leftEye)
  playerGroup.add(rightEye)

  // Define membrane points
  const retractedPoints = [
    new THREE.Vector3(0.4, 0.6, 0),
    new THREE.Vector3(0.45, 0.6, 0),
    new THREE.Vector3(0.42, 0.3, 0),
    new THREE.Vector3(-0.4, 0.6, 0),
    new THREE.Vector3(-0.45, 0.6, 0),
    new THREE.Vector3(-0.42, 0.3, 0),
  ]

  const extendedPoints = [
    new THREE.Vector3(0.4, 0.6, 0),
    new THREE.Vector3(0.8, 0.6, -0.2),
    new THREE.Vector3(0.6, 0.3, -0.2),
    new THREE.Vector3(-0.4, 0.6, 0),
    new THREE.Vector3(-0.8, 0.6, -0.2),
    new THREE.Vector3(-0.6, 0.3, -0.2),
  ]

  // Create membrane
  const membraneGeometry = new THREE.BufferGeometry()
  membraneGeometry.setFromPoints(retractedPoints)
  const membraneIndices = [0, 1, 2, 3, 4, 5]
  membraneGeometry.setIndex(membraneIndices)
  membraneGeometry.computeVertexNormals()

  const membraneMaterial = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  })
  const membrane = new THREE.Mesh(membraneGeometry, membraneMaterial)
  playerGroup.add(membrane)

  playerGroup.userData.membranes.push({
    mesh: membrane,
    retracted: retractedPoints.map((p) => p.clone()),
    extended: extendedPoints.map((p) => p.clone()),
    current: retractedPoints.map((p) => p.clone()),
  })

  // Create tail
  const tailCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.5, -0.3),
    new THREE.Vector3(0, 0.4, -0.5),
    new THREE.Vector3(0, 0.6, -0.7)
  )
  const tailGeometry = new THREE.TubeGeometry(tailCurve, 8, 0.06, 8, false)
  const tailMaterial = new THREE.MeshStandardMaterial({ color })
  const tail = new THREE.Mesh(tailGeometry, tailMaterial)
  playerGroup.add(tail)

  // Compute bounding box and adjust position
  playerGroup.updateMatrixWorld(true)
  const boundingBox = new THREE.Box3().setFromObject(playerGroup)
  const bottomY = boundingBox.min.y
  const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
  const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2

  // Adjust all child meshes to center on x,z and align bottom to y=0
  playerGroup.children.forEach((child) => {
    child.position.y -= bottomY
    child.position.x -= centerX
    child.position.z -= centerZ
  })

  // Also adjust membrane points
  playerGroup.userData.membranes.forEach((membrane) => {
    membrane.retracted.forEach((p) => {
      p.y -= bottomY
      p.x -= centerX
      p.z -= centerZ
    })
    membrane.extended.forEach((p) => {
      p.y -= bottomY
      p.x -= centerX
      p.z -= centerZ
    })
    membrane.current.forEach((p) => {
      p.y -= bottomY
      p.x -= centerX
      p.z -= centerZ
    })

    // Update membrane geometry with new points
    membrane.mesh.geometry.setFromPoints(membrane.current)
    membrane.mesh.geometry.computeVertexNormals()
  })

  return playerGroup
}

function animateMembranes(
  playerMesh: PlayerMesh,
  shouldExtend: boolean,
  lerpFactor: number
): void {
  if (!playerMesh.userData.membranes) return

  playerMesh.userData.membranes.forEach((membrane) => {
    const targetPoints = shouldExtend ? membrane.extended : membrane.retracted

    for (let i = 0; i < membrane.current.length; i++) {
      membrane.current[i].lerp(targetPoints[i], lerpFactor)
    }

    membrane.mesh.geometry.setFromPoints(membrane.current)
    membrane.mesh.geometry.computeVertexNormals()
  })
}

const isGliding = (position: THREE.Vector3) => {
  return position.y > GROUND_HEIGHT_THRESHOLD && !isNearTree(position)
}

// Initialize baby system
const babySystem = createBabySystem({
  scene,
  createPlayerMesh,
  isGliding: (position) =>
    position.y > GROUND_HEIGHT_THRESHOLD && !isNearTree(position),
  animateMembranes,
  getLocalPlayerId: () => localPlayerId(),
})

// Update socket events to use baby system
function setupSocketEvents() {
  socket.on('connect', () => {
    if (!socket.id) return
    localPlayerId(socket.id)
  })

  socket.on(
    'gameState',
    ({
      players,
      forestSeed,
      babyCount,
    }: {
      players: any[]
      forestSeed: number
      babyCount: any
    }) => {
      // Generate trees using the seed from server
      const treeData = generateForest(forestSeed)
      treeData.forEach((data) => {
        const tree = renderTree(data)
        trees.push(tree)
        scene.add(tree)
      })

      players.forEach((player) => {
        if (player.id !== socket.id && !otherPlayers.has(player.id)) {
          const playerMesh = createPlayerMesh()
          playerMesh.position.copy(player.position)
          scene.add(playerMesh)
          otherPlayers.set(player.id, playerMesh)

          const numBabies = player.babyCount || 0
          for (let i = 0; i < numBabies; i++) {
            babySystem.createBabySquirrel(player.id)
          }
        }
      })
    }
  )

  socket.on('playerJoined', (player: PlayerData) => {
    if (!otherPlayers.has(player.id)) {
      const playerMesh = createPlayerMesh()
      playerMesh.position.copy(player.position)
      scene.add(playerMesh)
      otherPlayers.set(player.id, playerMesh)

      const numBabies = player.babyCount || 0
      for (let i = 0; i < numBabies; i++) {
        babySystem.createBabySquirrel(player.id)
      }
    }
  })

  socket.on('playerUpdated', (data: PlayerData) => {
    const playerMesh = otherPlayers.get(data.id)
    if (playerMesh) {
      playerMesh.position.copy(data.position)
      playerMesh.position.y =
        data.position.y <= GROUND_HEIGHT_THRESHOLD ? 0 : data.position.y

      playerMesh.rotation.y = data.rotation.y

      const shouldExtend = isGliding(data.position)
      animateMembranes(playerMesh, shouldExtend, 0.1)

      if (data.babyCount !== undefined) {
        const currentBabies = babySystem.getBabiesForPlayer(data.id).length
        if (data.babyCount > currentBabies) {
          for (let i = currentBabies; i < data.babyCount; i++) {
            babySystem.createBabySquirrel(data.id)
          }
        }
      }
    }
  })

  socket.on('playerLeft', (playerId: string) => {
    const playerMesh = otherPlayers.get(playerId)
    if (playerMesh) {
      scene.remove(playerMesh)
      otherPlayers.delete(playerId)
      babySystem.removeBabiesForPlayer(playerId)
    }
  })
}

const controls = new PointerLockControls(povCamera, document.body)
povCamera.position.y = 2

let moveForward: boolean = false
let moveBackward: boolean = false
let moveLeft: boolean = false
let moveRight: boolean = false
let isClimbing: boolean = false
let leftTree: boolean = false

let flightTime: number = 0
let bestFlightTime: number = 0

let vitality: number = 100

const vitalityDecreaseRate: number = 5
const vitalityIncreaseRate: number = 2

const velocity = new THREE.Vector3()
const direction = new THREE.Vector3()

function lockPointer() {
  if (ui.isMobile) return
  if (!controls.isLocked) {
    controls.lock()
  }
}

function unlockPointer() {
  if (ui.isMobile) return
  if (controls.isLocked) {
    controls.unlock()
  }
}

document.addEventListener('click', lockPointer)

controls.addEventListener('lock', () => {
  if (ui.isMobile) return
})

controls.addEventListener('unlock', () => {
  if (ui.isMobile) return
  document.addEventListener('click', lockPointer, { once: true })
})

const consoleElement = document.getElementById('console') as HTMLDivElement
const consoleInput = consoleElement.querySelector('input') as HTMLInputElement

// Initialize berry system
const berry = createBerry({
  playBerrySound: () => audio.playBerrySound(),
  onBerryCountChange: (count: number) =>
    updateStatusBarItem('berry-count', count),
})

// Initialize command system with baby system
const commandSystem = createVibeCommands({
  berry,
  vitality,
  updateVitality,
  createBabySquirrel: (playerId: string) =>
    babySystem.createBabySquirrel(playerId),
  getLocalPlayerId: () => localPlayerId(),
  handlePointerLock: lockPointer,
  unlockPointer,
  toggleMute: () => audio.toggleMute(),
  toggleStore: () => store.toggleVisibility(),
})

// Initialize status bar with baby system
createStatusBarWithState(
  {
    vitality,
    berries: berry.getCount(),
    wingLevel,
    commandSystem,
    berry,
    onWingUpgrade: (level) => {
      wingLevel = level
      updateWingDisplay()
    },
    onBabySquirrel: () => {
      babySystem.createBabySquirrel(localPlayerId())
    },
    lockPointer,
    unlockPointer,
  },
  {
    toggleStore: () => store.toggleVisibility(),
    toggleMute: () => audio.toggleMute(),
    toggleConsole: () => commandSystem.toggleConsole(),
  }
)

// Initialize store with baby system
const store = createStore({
  berry,
  onWingUpgrade: (level: number) => {
    wingLevel = level
    updateWingDisplay()
  },
  onBabySquirrel: () => {
    babySystem.createBabySquirrel(localPlayerId())
  },
  lockPointer: lockPointer,
  unlockPointer,
})

commandSystem.setupConsole({
  input: consoleInput,
  element: consoleElement,
})

// Mobile controls
if (ui.isMobile) {
  ui.climbButton?.addEventListener('touchstart', () => {
    isClimbing = true
  })

  ui.climbButton?.addEventListener('touchend', () => {
    isClimbing = false
  })

  // Handle movement joystick
  ui.moveJoystick?.on(
    'move',
    (_evt: any, data: { vector: { x: number; y: number } }) => {
      // console.log(`vector`, data.vector.x, data.vector.y)
      // Convert joystick vector to movement
      // Use a threshold of 0.1 to prevent small movements from registering
      moveForward = data.vector.y > 0.1
      moveBackward = data.vector.y < -0.1
      moveLeft = data.vector.x < -0.1
      moveRight = data.vector.x > 0.1
    }
  )

  ui.moveJoystick?.on('end', () => {
    // Reset movement when joystick is released
    moveForward = false
    moveBackward = false
    moveLeft = false
    moveRight = false
  })

  // Handle look joystick
  ui.lookJoystick?.on(
    'move',
    (_evt: any, data: { vector: { x: number; y: number } }) => {
      // Use a threshold of 0.1 to prevent small movements from registering
      const thresholdX = Math.abs(data.vector.x) > 0.1 ? data.vector.x : 0
      const thresholdY = Math.abs(data.vector.y) > 0.1 ? data.vector.y : 0

      isLooking = thresholdX !== 0 || thresholdY !== 0
      lookX = -thresholdX * 0.025
      lookY = thresholdY * 0.025
    }
  )

  ui.lookJoystick?.on('end', () => {
    isLooking = false
    lookX = 0
    lookY = 0
  })

  document.getElementById('store-button')?.addEventListener('click', () => {
    document.getElementById('store')!.classList.toggle('visible')
  })
} else {
  // Desktop controls
  console.log('Desktop controls')
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    commandSystem.handleKeyDown(event)

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true
        break
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true
        break
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true
        break
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true
        break
      case 'Space':
        if (isNearTree(localPlayerModel.position)) {
          isClimbing = true
        }
        break
    }
  })

  document.addEventListener('keyup', (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false
        break
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false
        break
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false
        break
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false
        break
      case 'Space':
        isClimbing = false
        velocity.y = 0
        break
    }
  })
}

const clock = new THREE.Clock()

let oldDirectionX: number = 0
let oldDirectionZ: number = 0
function animate(): void {
  requestAnimationFrame(animate)

  babySystem.updateBabySquirrels()
  updateVitality(vitality)

  if (!renderer || !scene || !povCamera) {
    console.error('Missing essential components')
    return
  }

  if (ui.isMobile || (!ui.isMobile && controls.isLocked)) {
    const delta = clock.getDelta()

    const nearTree = isNearTree(localPlayerModel.position)

    // Remove debug logging for climbing state
    if (localPlayerModel.position.y <= GROUND_HEIGHT_THRESHOLD) {
      leftTree = false
      if (flightTime > bestFlightTime) {
        bestFlightTime = flightTime
        updateStatusBarItem('best-flight', bestFlightTime.toFixed(1))
      }
      flightTime = 0
      updateStatusBarItem('flight-time', '0.0')
    }

    const currentTime = Date.now()
    trees.forEach((tree) => {
      tree.userData.berries = tree.userData.berries.filter((berry) => {
        if (!berry.userData.collected) {
          const berryPos = new THREE.Vector3()
          berry.getWorldPosition(berryPos)

          // Berry debug sphere radius is 0.5, player debug sphere is 0.25
          // Total collision distance is 2 * (berry radius + player radius) = 2 * (0.5 + 0.25) = 1.5
          const collisionDistance = 1.5
          const distance = berryPos.distanceTo(localPlayerModel.position)

          if (distance < collisionDistance) {
            berry.userData.collected = true
            berry.userData.lastCollectedTime = Date.now()
            berry.visible = false
            if (berry.children.length > 0) {
              berry.children[0].visible = false // Hide debug sphere
            }
            tree.remove(berry)
            updateBerryCount(berries + 1)
            audio.playBerrySound()
            return false
          }
          return true
        }
        return false
      })

      // Replenish berries over time
      replenishBerries(tree, currentTime)
    })

    if (currentTime - lastBerrySpawnTime > BERRY_SPAWN_INTERVAL) {
      lastBerrySpawnTime = currentTime
    }

    if (nearTree) {
      leftTree = false
    } else if (
      !leftTree &&
      localPlayerModel.position.y > GROUND_HEIGHT_THRESHOLD
    ) {
      leftTree = true
    }

    // Update mama path for babies to follow
    babySystem.updateMamaPath(
      localPlayerModel.position.clone(),
      povCamera.rotation.y,
      localPlayerModel.position.y <= GROUND_HEIGHT_THRESHOLD
    )

    if (isGliding(localPlayerModel.position)) {
      activeCamera = chaseCamera

      const direction = new THREE.Vector3()
      povCamera.getWorldDirection(direction)

      // Calculate camera distance based on number of babies
      const babyCount = babySystem.getBabiesForPlayer(localPlayerId()).length
      const baseDistance = 15 // Base distance with no babies
      const distancePerBaby = 2 // Additional distance per baby
      const maxDistance = 40 // Maximum zoom out distance
      const targetDistance = Math.min(
        baseDistance + babyCount * distancePerBaby,
        maxDistance
      )

      const cameraOffset = new THREE.Vector3()
      cameraOffset.copy(direction).multiplyScalar(-targetDistance)
      cameraOffset.y = 8 + babyCount * 0.5 // Raise camera height slightly with more babies

      chaseCamera.position.copy(localPlayerModel.position).add(cameraOffset)
      chaseCamera.lookAt(localPlayerModel.position)
    } else {
      activeCamera = povCamera
    }

    if (isGliding(localPlayerModel.position)) {
      flightTime += delta
      updateStatusBarItem('flight-time', flightTime.toFixed(1))
    }

    if (!moveRight && !moveLeft) {
      velocity.x = 0
    }
    if (!moveForward && !moveBackward) {
      velocity.z = 0
    }

    // Update camera rotation if looking
    if (isLooking) {
      povCamera.rotation.y += lookX
      povCamera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, povCamera.rotation.x + lookY)
      )
      povCamera.rotation.z = 0 // Keep camera level
      povCamera.rotation.order = 'YXZ'
    }

    if (nearTree && isClimbing) {
      velocity.y = 10
    } else if (!nearTree && isClimbing) {
      isClimbing = false
    } else if (isGliding(localPlayerModel.position)) {
      const currentUpgrade = WING_UPGRADES.find((u) => u.level === wingLevel)!
      velocity.y -= currentUpgrade.glideStrength * delta
    } else {
      velocity.y -= 9.8 * delta
    }

    if (
      (moveForward || moveBackward || moveLeft || moveRight) &&
      localPlayerModel.position.y <= GROUND_HEIGHT_THRESHOLD
    ) {
      vitality = Math.max(0, vitality - vitalityDecreaseRate * delta)
    } else if (isGliding(localPlayerModel.position)) {
      vitality = vitality + vitalityIncreaseRate * delta
    }

    direction.z = Number(moveForward) - Number(moveBackward)
    direction.x = Number(moveRight) - Number(moveLeft)
    if (direction.x !== oldDirectionX || direction.z !== oldDirectionZ) {
      console.log(direction.x, direction.z)
      oldDirectionX = direction.x
      oldDirectionZ = direction.z
    }
    direction.normalize()

    // Base movement speed (units per second)
    const BASE_SPEED = 10.0

    // Only apply vitality speed penalty when on the ground
    const isGrounded = localPlayerModel.position.y <= GROUND_HEIGHT_THRESHOLD
    const speedMultiplier = isGrounded
      ? vitality > 0
        ? 0.5 + (vitality / 100) * 0.5
        : 0.15
      : 1.0

    // Calculate frame-rate independent velocity
    // Forward/backward at full speed, strafe at half speed
    const frameSpeed = BASE_SPEED * delta * speedMultiplier
    const frameStrafeSpeed = frameSpeed * 0.5

    // Calculate movement for this frame
    const frameVelocity = new THREE.Vector3()
    if (moveForward || moveBackward) {
      frameVelocity.z = -direction.z * frameSpeed
    }
    if (moveLeft || moveRight) {
      frameVelocity.x = -direction.x * frameStrafeSpeed
    }

    // Update player model position relative to camera direction
    const cameraDirection = new THREE.Vector3()
    povCamera.getWorldDirection(cameraDirection)
    // Only use horizontal components of camera direction
    cameraDirection.y = 0
    cameraDirection.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize()

    localPlayerModel.position.add(right.multiplyScalar(frameVelocity.x))
    localPlayerModel.position.add(
      cameraDirection.multiplyScalar(-frameVelocity.z)
    )

    // Update vertical position based on velocity BEFORE tree collision checks
    localPlayerModel.position.y += velocity.y * delta

    // Ground collision
    if (localPlayerModel.position.y < GROUND_HEIGHT_THRESHOLD) {
      velocity.y = 0
      localPlayerModel.position.y = 0
    }

    // Tree collision checks
    trees.forEach((tree) => {
      const treePos = new THREE.Vector3()
      tree.getWorldPosition(treePos)
      const distance = new THREE.Vector2(
        localPlayerModel.position.x - treePos.x,
        localPlayerModel.position.z - treePos.z
      ).length()
      const maxTreeHeight = tree.userData.height

      if (distance < NEAR_TREE_EPSILON) {
        if (isClimbing) {
          if (localPlayerModel.position.y > maxTreeHeight) {
            localPlayerModel.position.y = maxTreeHeight
            velocity.y = 0
            isClimbing = false
          }
        } else {
          if (localPlayerModel.position.y <= maxTreeHeight) {
            velocity.y = 0
          }
        }
      }
    })
  }

  const lerpFactor = 0.1

  animateMembranes(
    localPlayerModel,
    isGliding(localPlayerModel.position),
    lerpFactor
  )
  // Update camera to follow player model
  povCamera.position.copy(localPlayerModel.position)
  povCamera.position.y = localPlayerModel.position.y + CAMERA_PLAYER_OFFSET

  const cameraDirection = new THREE.Vector3()
  povCamera.getWorldDirection(cameraDirection)
  const rotationY = Math.atan2(cameraDirection.x, cameraDirection.z)

  localPlayerModel.rotation.y = rotationY

  otherPlayers.forEach((playerMesh) => {
    const shouldExtend =
      playerMesh.position.y > GROUND_HEIGHT_THRESHOLD &&
      !isNearTree(playerMesh.position)
    animateMembranes(playerMesh as PlayerMesh, shouldExtend, lerpFactor)
  })

  const moveData: Socket_PlayerData = {
    position: {
      x: localPlayerModel.position.x,
      y: localPlayerModel.position.y,
      z: localPlayerModel.position.z,
    },
    rotation: {
      x: 0,
      y: rotationY,
      z: 0,
    },
    babyCount: babySystem.getLocalBabyCount(),
  }
  // Only emit player movement if socket connection exists
  if (socket) {
    socket.emit('playerUpdate', moveData)
  }

  renderer.render(scene, activeCamera)
}

window.addEventListener('resize', () => {
  povCamera.aspect = window.innerWidth / window.innerHeight
  povCamera.updateProjectionMatrix()
  chaseCamera.aspect = window.innerWidth / window.innerHeight
  chaseCamera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
