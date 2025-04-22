import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import { dirname } from 'path'
import { Server, Socket } from 'socket.io'
import { fileURLToPath } from 'url'
import { Socket_PlayerData } from '../shared/types'
import createStaticServer from './static-server'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())

const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
})

// In production, serve static files from the Vite build
if (process.env.NODE_ENV === 'production') {
  createStaticServer(app)
}

const players = new Map<string, Socket_PlayerData>()
const babyCount = new Map<string, number>()

// Generate a deterministic seed based on the current day
// This ensures all players see the same forest, but it can change daily
const FOREST_SEED = Math.floor(Date.now() / (1000 * 60 * 60 * 24))

io.on('connection', (socket: Socket) => {
  console.log('Player connected:', socket.id)

  // Initialize the new player
  players.set(socket.id, {
    position: { x: 0, y: 2, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    babyCount: 0,
  })
  babyCount.set(socket.id, 0)

  // Send the current players list and forest seed to the new player
  socket.emit('gameState', {
    players: Array.from(players.values()),
    forestSeed: FOREST_SEED,
    babyCount: Object.fromEntries(babyCount),
  })

  // Broadcast the new player to all other players
  socket.broadcast.emit('playerJoined', players.get(socket.id))

  // Handle player movement updates
  socket.on('playerUpdate', (data: Socket_PlayerData) => {
    const player = players.get(socket.id)
    if (player) {
      player.position = data.position
      player.rotation = data.rotation
      player.babyCount = data.babyCount
      socket.broadcast.emit('playerUpdated', player)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id)
    players.delete(socket.id)
    babyCount.delete(socket.id)
    io.emit('playerLeft', socket.id)
  })
})

// Start the server
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
