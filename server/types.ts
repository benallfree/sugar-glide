// Game Types for Sugar Glide

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface SubBranch {
  relativePosition: number // Position along parent (0-1)
  length: number // Length of this sub-branch
  angle: number // Angle relative to parent branch
  elevation: number // Up/down angle
  thickness: number // Diameter of sub-branch
  hasLeaves: boolean // Whether this sub-branch has foliage
  leafDensity: number // 0-1 scale of foliage density
}

export interface Branch {
  id: string
  position: Vector3 // Starting position of branch
  length: number // Length of main branch
  thickness: number // Diameter of branch
  orientation: number // Rotation angle around trunk
  elevation: number // Angle from horizontal
  hasLeaves: boolean // Whether this branch has foliage
  leafDensity: number // 0-1 scale of foliage density
  children: SubBranch[] // Array of child branches
}

export interface Berry {
  id: string
  branchId: string
  position: Vector3
  collected: boolean
}

export interface Chunk {
  id: string
  baseHeight: number // Y position of chunk start
  branches: Branch[]
  berries: Berry[]
}

export interface PlayerState {
  id: string
  position: Vector3
  velocity: Vector3
  state: 'gliding' | 'climbing' | 'idle'
  vitality: number // 0-100%
  score: number
  babies: number
  loadedChunks: string[] // IDs of chunks loaded for this player
}

export interface GameState {
  players: Map<string, PlayerState>
  chunks: Map<string, Chunk>
}
