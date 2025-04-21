import * as THREE from 'three'

export interface MusicTrack {
  cost: number
  owned: boolean
}

export interface WingUpgrade {
  level: number
  cost: number
  glideStrength: number
  icon: string
}

export interface Berry extends THREE.Mesh {
  userData: {
    collected: boolean
    lastCollectedTime?: number
  }
}

export interface Tree extends THREE.Group {
  userData: { berries: Berry[]; height: number }
}

export interface PlayerMesh extends THREE.Group {
  userData: {
    membranes: Array<{
      mesh: THREE.Mesh
      retracted: THREE.Vector3[]
      extended: THREE.Vector3[]
      current: THREE.Vector3[]
    }>
  }
}

export interface PlayerData {
  id: string
  position: THREE.Vector3
  rotation: THREE.Vector3
  babyCount?: number
}

export interface PathPoint {
  pos: THREE.Vector3
  rot: number
  isGrounded: boolean
}

export interface VibeCommand {
  defaultQty: number
  description: string
  handler: (qty: number) => void
}

export interface GameState {
  players: PlayerData[]
  trees: { x: number; z: number; height: number }[]
}
