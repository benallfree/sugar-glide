import { GROUND_SIZE } from '../shared/constants'
import { createSeededRandom } from './util/random'

export type TreeBranch = {
  height: number
  length: number // length of the branch
  yawAngle: number // angle around trunk (0-2π)
  pitchAngle: number // angle up/down (-45 to +45 degrees)
  hasBerry: boolean
}

export type LeafCluster = {
  size: number
  height: number
  offsetX: number
  offsetZ: number
}

export type BerryPosition = {
  x: number
  y: number
  z: number
}

export type TreeData = {
  position: {
    x: number
    z: number
  }
  height: number
  trunkHeight: number
  branches: TreeBranch[]
  mainLeafSize: number
  leafClusters: LeafCluster[]
  berryCount: number
  berryPositions: BerryPosition[] // Normalized positions relative to leaf cluster size
}

function generateTreeDataFromSeed(
  radius: number,
  angle: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>
): TreeData {
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  const trunkHeight = height * 0.8
  const leavesSize = 3 + random.float() * 2
  const numLeafClusters = Math.floor(height / 8)

  // Generate branches with random positions and angles
  const numBranches = Math.floor(height / 4) + Math.floor(random.float() * 3)
  const branches: TreeBranch[] = []
  let berryCount = 3 // Fixed number for now, could be made variable

  const berryPositions: BerryPosition[] = []
  for (let i = 0; i < berryCount; i++) {
    // Generate random spherical coordinates
    const phi = random.float() * Math.PI * 2 // Random angle around Y axis
    const theta = Math.acos(2 * random.float() - 1) // Random angle from Y axis

    // Adjust radius range to avoid trunk (trunk radius is 0.7 at base, 0.3 at top)
    // Use 0.8 as minimum to give some clearance from trunk
    const minRadius = 0.8
    const r = minRadius + random.float() * (1 - minRadius) // Normalized radius between minRadius and 1

    // Convert to cartesian coordinates
    berryPositions.push({
      x: r * Math.sin(theta) * Math.cos(phi),
      y: r * Math.cos(theta),
      z: r * Math.sin(theta) * Math.sin(phi),
    })
  }

  const leafClusters: LeafCluster[] = []
  for (let i = 0; i < numLeafClusters; i++) {
    leafClusters.push({
      size: leavesSize * (0.4 + random.float() * 0.3),
      height: height * (0.6 + i * 0.1),
      offsetX: (random.float() - 0.5) * 2,
      offsetZ: (random.float() - 0.5) * 2,
    })
  }

  return {
    position: { x, z },
    height,
    trunkHeight,
    branches,
    mainLeafSize: leavesSize,
    leafClusters,
    berryCount,
    berryPositions,
  }
}

export function generateForest(seed: number): TreeData[] {
  const random = createSeededRandom(seed)
  const trees: TreeData[] = []

  const CENTER_DENSITY = 0.00258
  const PERIMETER_DENSITY = 0.00251
  const NUM_RINGS = 10
  const maxRadius = (GROUND_SIZE / 2) * 0.95

  // Generate trees in concentric rings for a natural distribution
  for (let ring = 0; ring < NUM_RINGS; ring++) {
    const innerRadius = (ring * maxRadius) / NUM_RINGS
    const outerRadius = ((ring + 1) * maxRadius) / NUM_RINGS
    const ringArea =
      Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius)

    // Density decreases linearly from center to perimeter
    const ringDensity =
      CENTER_DENSITY - (ring / NUM_RINGS) * (CENTER_DENSITY - PERIMETER_DENSITY)
    const numTreesInRing = Math.floor(ringArea * ringDensity)

    // Generate trees for this ring
    for (let i = 0; i < numTreesInRing; i++) {
      const angle = random.float() * Math.PI * 2
      const radius = random.range(innerRadius, outerRadius)

      // Trees get shorter towards the edges
      const centerFactor = 1 - radius / maxRadius
      const baseHeight = 10 + centerFactor * 15

      // Create true exponential distribution for height multiplier
      // e^x curve mapped and inverted to make tall trees very rare
      const x = random.float()
      const exp = Math.exp(x * 4) // Much steeper exponential curve (4 instead of 2)
      const normalized = (exp - 1) / (Math.E ** 4 - 1) // normalize to [0,1]
      const heightMultiplier = 1 + normalized * 2 // map to [1,3]

      const height = baseHeight * heightMultiplier

      trees.push(generateTreeDataFromSeed(radius, angle, height, random))
    }
  }

  return trees
}
