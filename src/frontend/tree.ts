import * as THREE from 'three'
import { BERRY_SPAWN_INTERVAL } from './constants'
import { TreeData } from './forest-generator'
import { Berry, Tree } from './types'

// Trees array will be populated with rendered trees when received from server
export const trees: Tree[] = []

// Berry size constants
const BERRY_RADIUS = 0.2
const DEBUG_SPHERE_RADIUS = BERRY_RADIUS * 2

// Create debug material for collection radius visualization
const debugMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.2,
  wireframe: true,
})

// Update Tree userData type
declare module './types' {
  interface Tree extends THREE.Group {
    userData: {
      berries: Berry[]
      height: number
    }
  }
}

export function addBerryToTree(tree: Tree, height: number): void {
  const berryHeight = Math.random() * (height - 2) + 2
  const berryAngle = Math.random() * Math.PI * 2
  const berryRadius = 1 + Math.random()

  const berry = new THREE.Mesh(
    new THREE.SphereGeometry(BERRY_RADIUS),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  ) as unknown as Berry

  berry.userData = { collected: false }
  berry.position.set(
    Math.cos(berryAngle) * berryRadius,
    berryHeight,
    Math.sin(berryAngle) * berryRadius
  )

  // Add debug sphere to visualize collection radius
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(DEBUG_SPHERE_RADIUS),
    debugMaterial
  )
  debugSphere.position.copy(berry.position)
  berry.add(debugSphere)

  berry.userData = { collected: false }
  tree.userData.berries.push(berry)
  tree.add(berry)
}

export function addBerryToBranchEnd(tree: Tree, branch: THREE.Mesh): void {
  const berry = new THREE.Mesh(
    new THREE.SphereGeometry(BERRY_RADIUS),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  ) as unknown as Berry

  berry.userData = { collected: false }

  // Position berry at end of branch
  const branchLength = 3.5 // matches branch creation
  berry.position.set(
    branchLength * Math.cos(Math.PI / 4), // Account for branch rotation
    0,
    0
  )

  // Add debug sphere to visualize collection radius
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(DEBUG_SPHERE_RADIUS),
    debugMaterial
  )
  debugSphere.position.copy(berry.position)
  berry.add(debugSphere)

  tree.userData.berries.push(berry)
  branch.add(berry) // Attach to branch instead of tree directly
}

export function renderTree(treeData: TreeData): Tree {
  const treeGroup = new THREE.Group() as Tree
  treeGroup.userData = { berries: [], height: treeData.height }
  treeGroup.position.set(treeData.position.x, 0, treeData.position.z)

  // Create trunk that extends the full height
  const trunkGeometry = new THREE.CylinderGeometry(
    0.3, // Thinner at top
    0.7, // Wider at base
    treeData.height, // Full height
    8
  )
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
  trunk.position.y = treeData.height / 2 // Center at half height
  treeGroup.add(trunk)

  // Create main leaf cluster
  const leavesGeometry = new THREE.SphereGeometry(treeData.mainLeafSize, 8, 8)
  const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 })
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial)
  leaves.position.y = treeData.height - treeData.mainLeafSize
  treeGroup.add(leaves)

  // Add berries to the leaf cluster surface
  const berryGeometry = new THREE.SphereGeometry(BERRY_RADIUS)
  const berryMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })

  // Use the seeded berry positions from TreeData
  for (const berryPos of treeData.berryPositions) {
    const berryGroup = new THREE.Group()
    const berry = new THREE.Mesh(
      berryGeometry,
      berryMaterial
    ) as unknown as Berry
    berry.userData = { collected: false }

    // Scale the normalized positions by the leaf cluster size
    const x = berryPos.x * treeData.mainLeafSize
    const y = berryPos.y * treeData.mainLeafSize
    const z = berryPos.z * treeData.mainLeafSize

    berryGroup.position.set(x, y, z)

    // Add berry at local origin of group
    berry.position.set(0, 0, 0)
    berryGroup.add(berry)

    // Add debug sphere at same local origin
    const debugSphere = new THREE.Mesh(
      new THREE.SphereGeometry(DEBUG_SPHERE_RADIUS),
      debugMaterial
    )
    debugSphere.position.set(0, 0, 0)
    debugSphere.visible = false
    debugSphere.userData.isDebugSphere = true
    berryGroup.add(debugSphere)

    // Add group to leaves and track berry
    leaves.add(berryGroup)
    treeGroup.userData.berries.push(berry)
  }

  // Compute bounding box and adjust position
  treeGroup.updateMatrixWorld(true)
  const boundingBox = new THREE.Box3().setFromObject(treeGroup)
  const bottomY = boundingBox.min.y

  // Adjust all child meshes
  treeGroup.children.forEach((child) => {
    child.position.y -= bottomY
  })

  return treeGroup
}

export function isNearTree(position: THREE.Vector3): boolean {
  for (const tree of trees) {
    const treePos = new THREE.Vector3()
    tree.getWorldPosition(treePos)
    const distance = new THREE.Vector2(
      position.x - treePos.x,
      position.z - treePos.z
    ).length()

    // Only count as near if within horizontal distance AND below tree height
    if (distance < 2 && position.y <= tree.userData.height) {
      return true
    }
  }
  return false
}

export function findBranchesInRange(
  tree: Tree,
  position: THREE.Vector3,
  radius: number
): THREE.Mesh[] {
  const branches: THREE.Mesh[] = []

  tree.traverse((object) => {
    // Skip if not a mesh or doesn't have endpoint data
    if (!(object instanceof THREE.Mesh) || !object.userData.endPoint) {
      return
    }

    // Get world position of branch endpoint
    const worldEndPoint = object.userData.endPoint.clone()
    object.localToWorld(worldEndPoint)

    // Check if endpoint is within radius
    const distance = position.distanceTo(worldEndPoint)
    if (distance <= radius && !object.userData.hasBerry) {
      branches.push(object as THREE.Mesh)
    }
  })

  return branches
}

// Example berry spawning function
export function spawnBerriesNearPosition(
  tree: Tree,
  position: THREE.Vector3,
  radius: number,
  spawnChance = 0.3
): void {
  const availableBranches = findBranchesInRange(tree, position, radius)

  availableBranches.forEach((branch) => {
    if (Math.random() < spawnChance) {
      addBerryToBranchEnd(tree, branch)
      branch.userData.hasBerry = true
    }
  })
}

export function replenishBerries(tree: Tree, currentTime: number): void {
  // Filter out collected berries that are ready to respawn
  const collectedBerries = tree.userData.berries.filter((berry) => {
    if (!berry.userData.collected) return false
    const timeSinceCollection =
      currentTime - (berry.userData.lastCollectedTime || 0)
    return timeSinceCollection >= BERRY_SPAWN_INTERVAL
  })

  // Respawn each ready berry
  collectedBerries.forEach((berry) => {
    berry.userData.collected = false
    berry.visible = true
    if (berry.children.length > 0) {
      berry.children[0].visible = true // Show debug sphere
    }
  })
}

export function updateDebugVisibility(isDebugMode: boolean): void {
  trees.forEach((tree) => {
    tree.traverse((object) => {
      // Only update objects marked as debug spheres
      if (object instanceof THREE.Mesh && object.userData.isDebugSphere) {
        // Show debug sphere only if debug mode is on AND the parent berry is not collected
        const berry = object.parent?.children.find(
          (child) =>
            child instanceof THREE.Mesh && !child.userData.isDebugSphere
        ) as Berry | undefined
        object.visible = isDebugMode && !!berry && !berry.userData.collected
      }
    })
  })
}
