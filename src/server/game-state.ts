import { v4 as uuid } from 'uuid'
import { Berry, Branch, Chunk, GameState, PlayerState, Vector3 } from './types'

// Constants
const CHUNK_HEIGHT = 20
const BRANCHES_PER_CHUNK = 4
const BERRIES_PER_CHUNK = 2
const BRANCH_SPAWN_HEIGHTS = [5, 10, 15, 20] // Relative to chunk base
const VISIBILITY_RANGE = 60 // How far up/down players can see

/**
 * Helper functions for game state management
 */
const randomRange = (min: number, max: number): number => {
  return min + Math.random() * (max - min)
}

/**
 * Generate a branch at a specific height
 */
const generateBranch = (y: number): Branch => {
  // Base branch properties
  const branch: Branch = {
    id: uuid(),
    position: {
      x: randomRange(-15, 15),
      y,
      z: randomRange(-15, 15),
    },
    length: randomRange(5, 10),
    thickness: Math.max(0.3, 1 - y / 1000), // Thinner as we go higher
    orientation: randomRange(0, Math.PI * 2),
    elevation: randomRange(-0.1, 0.2),
    hasLeaves: Math.random() < 0.3 + y / 1000, // More leaves higher up
    leafDensity: randomRange(0.3, 1.0),
    children: [],
  }

  // Determine if branch splits
  const splitChance = 0.3 + y / 2000 // More splits higher up
  if (Math.random() < splitChance) {
    const numSplits = Math.floor(randomRange(1, 4))

    for (let i = 0; i < numSplits; i++) {
      branch.children.push({
        relativePosition: randomRange(0.4, 0.8),
        length: branch.length * randomRange(0.4, 0.8),
        angle: randomRange(Math.PI / 12, Math.PI / 4) * (Math.random() > 0.5 ? 1 : -1),
        elevation: randomRange(-0.1, 0.3),
        thickness: branch.thickness * randomRange(0.4, 0.7),
        hasLeaves: Math.random() < 0.8,
        leafDensity: randomRange(0.5, 1.0),
      })
    }
  } else if (Math.random() < 0.7) {
    // No splits, but high chance of leaves on terminal branches
    branch.hasLeaves = true
    branch.leafDensity = randomRange(0.7, 1.0)
  }

  return branch
}

/**
 * Generate berries for a chunk
 */
const generateBerries = (branches: Branch[]): Berry[] => {
  const berries: Berry[] = []
  const numBerries = Math.floor(randomRange(1, BERRIES_PER_CHUNK + 1))

  // Randomly select branches to place berries on
  const branchIndices = new Set<number>()
  while (branchIndices.size < numBerries && branchIndices.size < branches.length) {
    branchIndices.add(Math.floor(Math.random() * branches.length))
  }

  // Create berries on selected branches
  branchIndices.forEach((index) => {
    const branch = branches[index]

    // Position along the branch (0.3-0.9 of branch length)
    const relativePos = randomRange(0.3, 0.9)
    const branchOrientation = branch.orientation

    // Calculate position
    const berryPosition: Vector3 = {
      x: branch.position.x + Math.cos(branchOrientation) * branch.length * relativePos,
      y: branch.position.y + branch.elevation * branch.length * relativePos,
      z: branch.position.z + Math.sin(branchOrientation) * branch.length * relativePos,
    }

    berries.push({
      id: uuid(),
      branchId: branch.id,
      position: berryPosition,
      collected: false,
    })
  })

  return berries
}

/**
 * Generate a chunk at a specific base height
 */
const generateChunk = (baseHeight: number): Chunk => {
  const branches: Branch[] = []

  // Generate branches at specific heights within the chunk
  for (let i = 0; i < BRANCHES_PER_CHUNK; i++) {
    const branchHeight = baseHeight + BRANCH_SPAWN_HEIGHTS[i]
    branches.push(generateBranch(branchHeight))
  }

  // Generate berries for this chunk
  const berries = generateBerries(branches)

  return {
    id: `chunk-${baseHeight}`,
    baseHeight,
    branches,
    berries,
  }
}

/**
 * Create a new game state manager
 */
const createGameState = () => {
  // Initialize game state
  const state: GameState = {
    players: new Map<string, PlayerState>(),
    chunks: new Map<string, Chunk>(),
  }

  /**
   * Add a new player to the game
   */
  const addPlayer = (playerId: string): PlayerState => {
    // Initial player state
    const player: PlayerState = {
      id: playerId,
      position: { x: 0, y: 10, z: 0 }, // Start 10 units above ground
      velocity: { x: 0, y: 0, z: 0 },
      state: 'idle',
      vitality: 100,
      score: 0,
      babies: 0,
      loadedChunks: [],
    }

    state.players.set(playerId, player)
    return player
  }

  /**
   * Remove a player from the game
   */
  const removePlayer = (playerId: string): void => {
    state.players.delete(playerId)
  }

  /**
   * Update player position and state
   */
  const updatePlayerState = (
    playerId: string,
    position: Vector3,
    velocity: Vector3,
    playerState: 'gliding' | 'climbing' | 'idle'
  ): void => {
    const player = state.players.get(playerId)
    if (!player) return

    // Update player state
    player.position = position
    player.velocity = velocity
    player.state = playerState

    // Update score if gliding
    if (playerState === 'gliding') {
      player.score += 1
    }

    // Decrease vitality (1% per second, assuming updates every 100ms)
    player.vitality = Math.max(0, player.vitality - 0.1)

    // Check if player touched the ground
    if (position.y <= 0 && player.babies > 0) {
      player.babies -= 1
    }

    // Check if game over (no vitality and no babies)
    if (player.vitality <= 0 && player.babies === 0) {
      // Respawn the player
      player.position = { x: 0, y: 10, z: 0 }
      player.velocity = { x: 0, y: 0, z: 0 }
      player.vitality = 100
    }
  }

  /**
   * Get chunks needed for a player based on position
   */
  const getChunksForPlayer = (playerPosition: Vector3): Chunk[] => {
    const centerChunkBaseHeight = Math.floor(playerPosition.y / CHUNK_HEIGHT) * CHUNK_HEIGHT
    const chunksNeeded: number[] = [
      centerChunkBaseHeight - CHUNK_HEIGHT,
      centerChunkBaseHeight,
      centerChunkBaseHeight + CHUNK_HEIGHT,
    ]

    const chunks: Chunk[] = []

    chunksNeeded.forEach((baseHeight) => {
      // Don't generate chunks below ground
      if (baseHeight < 0) return

      const chunkId = `chunk-${baseHeight}`
      let chunk = state.chunks.get(chunkId)

      if (!chunk) {
        // Generate new chunk if it doesn't exist
        chunk = generateChunk(baseHeight)
        state.chunks.set(chunkId, chunk)
      }

      chunks.push(chunk)
    })

    return chunks
  }

  /**
   * Get nearby players based on position
   */
  const getNearbyPlayers = (playerId: string): PlayerState[] => {
    const player = state.players.get(playerId)
    if (!player) return []

    // Get all players within range of this player
    return Array.from(state.players.values()).filter((otherPlayer) => {
      if (otherPlayer.id === playerId) return false

      // Calculate vertical distance
      const verticalDistance = Math.abs(player.position.y - otherPlayer.position.y)

      // Calculate horizontal distance
      const dx = player.position.x - otherPlayer.position.x
      const dz = player.position.z - otherPlayer.position.z
      const horizontalDistance = Math.sqrt(dx * dx + dz * dz)

      // Include player if they are within visibility range vertically
      // and not too far horizontally
      return verticalDistance < VISIBILITY_RANGE && horizontalDistance < 30
    })
  }

  /**
   * Collect a berry by ID
   */
  const collectBerry = (playerId: string, chunkId: string, berryId: string): boolean => {
    const chunk = state.chunks.get(chunkId)
    if (!chunk) return false

    const berry = chunk.berries.find((b) => b.id === berryId)
    if (!berry || berry.collected) return false

    // Mark berry as collected
    berry.collected = true

    // Update player vitality
    const player = state.players.get(playerId)
    if (player) {
      player.vitality = Math.min(100, player.vitality + 50)
      return true
    }

    return false
  }

  /**
   * Process a kiss between two players
   */
  const processKiss = (player1Id: string, player2Id: string): boolean => {
    const player1 = state.players.get(player1Id)
    const player2 = state.players.get(player2Id)

    if (!player1 || !player2) return false

    // Check if players are close enough
    const dx = player1.position.x - player2.position.x
    const dy = player1.position.y - player2.position.y
    const dz = player1.position.z - player2.position.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (distance > 2) return false

    // Add a baby to both players
    player1.babies += 1
    player2.babies += 1

    return true
  }

  return {
    addPlayer,
    removePlayer,
    updatePlayerState,
    getChunksForPlayer,
    getNearbyPlayers,
    collectBerry,
    processKiss,
  }
}

export default createGameState
