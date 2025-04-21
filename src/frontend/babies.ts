import * as THREE from 'three'
import { audio } from './audio'
import {
  BABY_SCALE,
  MAX_SPEED,
  MIN_DISTANCE,
  PATH_MEMORY,
  PATH_SPACING,
  SEPARATION_RADIUS,
} from './constants'
import { onPlayerIdentityChanged } from './events'
import { updateStatusBarItem } from './status-bar'
import { PathPoint, PlayerMesh } from './types'

export interface BabyDependencies {
  scene: THREE.Scene
  createPlayerMesh: () => PlayerMesh
  isGliding: (position: THREE.Vector3) => boolean
  animateMembranes: (
    playerMesh: PlayerMesh,
    shouldExtend: boolean,
    lerpFactor: number
  ) => void
  getLocalPlayerId: () => string
}

export interface BabySystem {
  createBabySquirrel: (playerId: string) => PlayerMesh
  updateBabySquirrels: () => void
  getBabiesForPlayer: (playerId: string) => PlayerMesh[]
  removeBabiesForPlayer: (playerId: string) => void
  getLocalBabyCount: () => number
  updateMamaPath: (
    position: THREE.Vector3,
    rotation: number,
    isGrounded: boolean
  ) => void
}

export const createBabySystem = (deps: BabyDependencies): BabySystem => {
  const playerBabies: Map<string, PlayerMesh[]> = new Map()
  const mamaPath: PathPoint[] = []
  const lastPathPoint = new THREE.Vector3()

  const getBabies = (playerId: string): PlayerMesh[] => {
    if (!playerBabies.has(playerId)) {
      playerBabies.set(playerId, [])
    }
    return playerBabies.get(playerId)!
  }

  // Listen for player identity changes
  onPlayerIdentityChanged((e) => {
    const { oldId, newId } = e.detail
    if (playerBabies.has(oldId)) {
      playerBabies.set(newId, getBabies(oldId))
      playerBabies.delete(oldId)
    }
  })

  const createBabySquirrel = (playerId: string): PlayerMesh => {
    const baby = deps.createPlayerMesh()
    baby.scale.set(BABY_SCALE, BABY_SCALE, BABY_SCALE)

    // Give each baby a random initial position in a circle
    const randomAngle = Math.random() * Math.PI * 2
    const randomRadius = 2 + Math.random() * 2 // Random distance between 2-4 units
    baby.position.set(
      Math.cos(randomAngle) * randomRadius,
      0,
      Math.sin(randomAngle) * randomRadius
    )

    deps.scene.add(baby)

    getBabies(playerId).push(baby)

    if (playerId === deps.getLocalPlayerId()) {
      const babyCount = getBabies(playerId).length
      updateStatusBarItem('baby-count', babyCount)
      audio.playBabySound()
    }

    return baby
  }

  const updateBabyWithFlocking = (
    baby: PlayerMesh,
    mamaPosition: THREE.Vector3,
    mamaRotation: number,
    siblings: PlayerMesh[],
    isGliding: boolean,
    heightOffset: number = 2
  ): void => {
    const toMama = new THREE.Vector3()
    toMama.subVectors(mamaPosition, baby.position)
    const distanceToMama = toMama.length()

    // Base movement speed is much slower when mama isn't moving
    const isMamaMoving = lastPathPoint.distanceTo(mamaPosition) > 0.01
    const baseSpeed = isMamaMoving ? MAX_SPEED : MAX_SPEED * 0.05 // Even slower when idle

    const desiredVelocity = new THREE.Vector3()

    if (isMamaMoving) {
      // When mama is moving, focus on following her direction
      if (distanceToMama > MIN_DISTANCE) {
        const distanceFactor = (distanceToMama - MIN_DISTANCE) / distanceToMama
        desiredVelocity.add(
          toMama.normalize().multiplyScalar(baseSpeed * distanceFactor)
        )
      }
    } else {
      // When mama is still, do gentle exploration
      const time = Date.now() * 0.001 // Convert to seconds
      const uniqueOffset = baby.uuid.charCodeAt(0) * 0.1 // Unique per baby

      if (distanceToMama < MIN_DISTANCE * 1.5) {
        // Generate a wandering direction that changes periodically
        const directionChangeSpeed = 0.2 // How often to change direction
        const directionPhase = Math.floor(
          time * directionChangeSpeed + uniqueOffset
        )

        // Use the phase to generate a stable random angle for this time period
        const targetAngle = Math.sin(directionPhase) * Math.PI // Range of ±π

        // Smoothly rotate towards the target angle
        const currentAngle = baby.rotation.y % (Math.PI * 2)
        const angleDiff =
          ((targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        baby.rotation.y += angleDiff * 0.02 // Very smooth rotation

        // Move in the direction we're looking, but gently
        const moveSpeed = 0.1
        desiredVelocity.x = Math.sin(baby.rotation.y) * moveSpeed
        desiredVelocity.z = Math.cos(baby.rotation.y) * moveSpeed
      } else {
        // If too far, gently return to flock
        const returnStrength =
          (distanceToMama - MIN_DISTANCE * 1.5) / distanceToMama
        desiredVelocity.add(
          toMama.normalize().multiplyScalar(baseSpeed * returnStrength)
        )

        // Look where we're going when returning
        const targetAngle = Math.atan2(toMama.x, toMama.z)
        const currentAngle = baby.rotation.y % (Math.PI * 2)
        const angleDiff =
          ((targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        baby.rotation.y += angleDiff * 0.1
      }
    }

    // Always maintain minimum separation from siblings
    siblings.forEach((otherBaby) => {
      if (otherBaby !== baby) {
        const away = new THREE.Vector3()
        away.subVectors(baby.position, otherBaby.position)
        const dist = away.length()
        if (dist < SEPARATION_RADIUS) {
          const pushStrength = (1 - dist / SEPARATION_RADIUS) * baseSpeed
          desiredVelocity.add(away.normalize().multiplyScalar(pushStrength))
        }
      }
    })

    // Smooth vertical movement
    const targetHeight =
      mamaPosition.y <= 2.1 ? 0 : mamaPosition.y - heightOffset
    const heightDiff = targetHeight - baby.position.y
    desiredVelocity.y = heightDiff * baseSpeed * 0.5 // Proportional to distance, half speed for smoothness

    // Store the previous position to calculate actual movement direction
    const previousPosition = baby.position.clone()

    // Apply the movement
    baby.position.add(desiredVelocity)

    // When following mama, face the direction of movement
    if (isMamaMoving) {
      const actualMovement = new THREE.Vector3().subVectors(
        baby.position,
        previousPosition
      )
      if (actualMovement.length() > 0.001) {
        const targetRotation = Math.atan2(actualMovement.x, actualMovement.z)
        const currentAngle = baby.rotation.y % (Math.PI * 2)
        const angleDiff =
          ((targetRotation - currentAngle + Math.PI * 3) % (Math.PI * 2)) -
          Math.PI
        baby.rotation.y += angleDiff * 0.1
      }
    }

    // Update membranes
    deps.animateMembranes(baby, isGliding, 0.1)
  }

  const updateBabySquirrels = (): void => {
    const localBabies = getBabies(deps.getLocalPlayerId())
    localBabies.forEach((baby, index) => {
      const pathIndex = Math.max(0, mamaPath.length - 1 - (index + 1) * 3)
      const targetPoint = mamaPath[pathIndex] || {
        pos: new THREE.Vector3(),
        rot: 0,
        isGrounded: true,
      }

      if (targetPoint.isGrounded) {
        updateBabyWithFlocking(
          baby,
          targetPoint.pos,
          targetPoint.rot,
          localBabies,
          deps.isGliding(baby.position),
          2
        )
      } else {
        const lerpSpeed = 0.1
        baby.position.lerp(targetPoint.pos, lerpSpeed)

        const nextIndex = Math.min(pathIndex + 1, mamaPath.length - 1)
        const nextPoint = mamaPath[nextIndex]

        if (nextPoint) {
          const direction = new THREE.Vector3()
          direction.subVectors(nextPoint.pos, targetPoint.pos)

          if (direction.length() > 0.001) {
            const targetAngle = Math.atan2(direction.x, direction.z)
            baby.rotation.y = THREE.MathUtils.lerp(
              baby.rotation.y,
              targetAngle,
              lerpSpeed
            )
          }
        }
      }
    })

    // Update other players' babies
    playerBabies.forEach((babies, playerId) => {
      if (playerId !== deps.getLocalPlayerId()) {
        babies.forEach((baby) => {
          updateBabyWithFlocking(
            baby,
            baby.position, // Use current position as target since we don't have other player paths
            baby.rotation.y,
            babies,
            deps.isGliding(baby.position),
            0
          )
        })
      }
    })
  }

  const updateMamaPath = (
    position: THREE.Vector3,
    rotation: number,
    isGrounded: boolean
  ) => {
    if (position.distanceTo(lastPathPoint) > PATH_SPACING) {
      mamaPath.push({
        pos: position.clone(),
        rot: rotation,
        isGrounded,
      })
      if (mamaPath.length > PATH_MEMORY) {
        mamaPath.shift()
      }
      lastPathPoint.copy(position)
    }
  }

  const getBabiesForPlayer = (playerId: string): PlayerMesh[] => {
    return getBabies(playerId)
  }

  const removeBabiesForPlayer = (playerId: string) => {
    const babies = getBabies(playerId)
    babies.forEach((baby) => deps.scene.remove(baby))
    playerBabies.delete(playerId)
  }

  const getLocalBabyCount = (): number => {
    return getBabies(deps.getLocalPlayerId()).length
  }

  return {
    createBabySquirrel,
    updateBabySquirrels,
    getBabiesForPlayer,
    removeBabiesForPlayer,
    getLocalBabyCount,
    updateMamaPath,
  }
}
