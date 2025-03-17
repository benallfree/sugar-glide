import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
import createGameState from './game-state'
import createStaticServer from './static-server'
import { Vector3 } from './types'

/**
 * Create and configure the game server
 * Uses function factory pattern as per project style
 */
const createGameServer = () => {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? false // Disable CORS in production as we serve frontend from same origin
          : 'http://localhost:5173', // Allow CORS from Vite dev server
      methods: ['GET', 'POST'],
    },
  })

  const PORT = process.env.PORT || 3000

  // Create the game state manager
  const gameState = createGameState()

  // In production, serve static files from the Vite build
  if (process.env.NODE_ENV === 'production') {
    createStaticServer(app)
  }

  // Set up Socket.io connection handling
  const setupSocketHandlers = () => {
    io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`)

      // Add player to game state
      const player = gameState.addPlayer(socket.id)

      // Send welcome message to client
      socket.emit('message', 'Welcome to Sugar Glide! 🐿️')
      socket.emit('playerJoined', {
        id: player.id,
        position: player.position,
        vitality: player.vitality,
        score: player.score,
        babies: player.babies,
      })

      // Send initial chunks to player
      const initialChunks = gameState.getChunksForPlayer(player.position)
      socket.emit('chunkData', { chunks: initialChunks })

      // Broadcast to all other clients that a new player joined
      socket.broadcast.emit('message', 'A new player has joined the forest!')

      // Handler for player position updates
      socket.on(
        'updatePosition',
        (data: {
          position: Vector3
          velocity: Vector3
          state: 'gliding' | 'climbing' | 'idle'
        }) => {
          if (!data.position || !data.velocity || !data.state) return

          // Update player state in game
          gameState.updatePlayerState(socket.id, data.position, data.velocity, data.state)

          // Get chunks for this player based on new position
          const currentPlayer = gameState.getChunksForPlayer(data.position)

          // Find chunks that the player doesn't already have loaded
          const newChunks = currentPlayer.filter((chunk) => !player.loadedChunks.includes(chunk.id))

          // If there are new chunks, send them to the player
          if (newChunks.length > 0) {
            socket.emit('chunkData', { chunks: newChunks })

            // Update player's loaded chunks
            player.loadedChunks = [...player.loadedChunks, ...newChunks.map((chunk) => chunk.id)]
          }

          // Get nearby players
          const nearbyPlayers = gameState.getNearbyPlayers(socket.id)

          // Send nearby player positions (if any)
          if (nearbyPlayers.length > 0) {
            socket.emit('playerPositions', {
              players: nearbyPlayers.map((p) => ({
                id: p.id,
                position: p.position,
                velocity: p.velocity,
                state: p.state,
                babies: p.babies,
              })),
            })

            // Also send this player's position to nearby players
            nearbyPlayers.forEach((p) => {
              const nearbySocket = io.sockets.sockets.get(p.id)
              if (nearbySocket) {
                nearbySocket.emit('playerPositions', {
                  players: [
                    {
                      id: socket.id,
                      position: data.position,
                      velocity: data.velocity,
                      state: data.state,
                      babies: player.babies,
                    },
                  ],
                })
              }
            })
          }

          // Update vitality and score for this player
          socket.emit('updateVitality', {
            playerId: socket.id,
            vitality: player.vitality,
          })

          socket.emit('updateScore', {
            playerId: socket.id,
            score: player.score,
          })
        }
      )

      // Handler for berry collection
      socket.on('collectBerry', (data: { berryId: string; chunkId: string }) => {
        if (!data.berryId || !data.chunkId) return

        const success = gameState.collectBerry(socket.id, data.chunkId, data.berryId)

        if (success) {
          // Confirm berry collection to the player
          socket.emit('berryCollected', {
            berryId: data.berryId,
            chunkId: data.chunkId,
            playerId: socket.id,
            newVitality: player.vitality,
          })

          // Broadcast berry collection to other players
          socket.broadcast.emit('berryCollected', {
            berryId: data.berryId,
            chunkId: data.chunkId,
            playerId: socket.id,
          })
        }
      })

      // Handler for kiss initiation
      socket.on('initiateKiss', (data: { targetPlayerId: string }) => {
        if (!data.targetPlayerId) return

        const targetSocket = io.sockets.sockets.get(data.targetPlayerId)
        if (targetSocket) {
          // Send kiss request to target player
          targetSocket.emit('kissRequest', { fromPlayerId: socket.id })
        }
      })

      // Handler for kiss acceptance
      socket.on('acceptKiss', (data: { fromPlayerId: string }) => {
        if (!data.fromPlayerId) return

        const success = gameState.processKiss(socket.id, data.fromPlayerId)

        if (success) {
          // Notify both players about the successful kiss
          socket.emit('kissCompleted', {
            player1Id: socket.id,
            player2Id: data.fromPlayerId,
          })

          const fromSocket = io.sockets.sockets.get(data.fromPlayerId)
          if (fromSocket) {
            fromSocket.emit('kissCompleted', {
              player1Id: data.fromPlayerId,
              player2Id: socket.id,
            })
          }

          // Notify both players about new babies
          const updatedPlayer = gameState.addPlayer(socket.id)
          socket.emit('babyAdded', {
            playerId: socket.id,
            totalBabies: updatedPlayer.babies,
          })

          if (fromSocket) {
            const fromPlayer = gameState.addPlayer(data.fromPlayerId)
            fromSocket.emit('babyAdded', {
              playerId: data.fromPlayerId,
              totalBabies: fromPlayer.babies,
            })
          }

          // Broadcast the kiss to nearby players
          socket.broadcast.emit('kissCompleted', {
            player1Id: socket.id,
            player2Id: data.fromPlayerId,
          })
        }
      })

      // Handler for player touching ground
      socket.on('playerGrounded', () => {
        const updatedPlayer = gameState.addPlayer(socket.id)

        // Notify player about losing a baby
        socket.emit('loseBaby', {
          playerId: socket.id,
          reason: 'ground',
          remainingBabies: updatedPlayer.babies,
        })

        // Check for game over
        if (updatedPlayer.vitality <= 0 && updatedPlayer.babies <= 0) {
          socket.emit('gameOver', { playerId: socket.id })

          // Respawn player (already handled in updatePlayerState)
          socket.emit('respawn', {
            playerId: socket.id,
            position: updatedPlayer.position,
            vitality: updatedPlayer.vitality,
          })
        }
      })

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`)

        // Remove player from game state
        gameState.removePlayer(socket.id)

        // Notify other players
        socket.broadcast.emit('playerLeft', { playerId: socket.id })
        socket.broadcast.emit('message', 'A player has left the forest.')
      })
    })
  }

  // Start the server
  const start = () => {
    setupSocketHandlers()

    server.listen(PORT, () => {
      console.log(`Game server running on http://localhost:${PORT}`)
    })
  }

  return { start }
}

// Create and start the game server
const gameServer = createGameServer()
gameServer.start()
