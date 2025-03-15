### Sugar Glide MVP Specification

**Intro:**  
_Sugar Glide_ is a minimalist 3D MMO web game where up to 100 players control sugar gliders in a shared, infinitely high tree world. Glide between branches, climb the trunk, eat berries to survive, and "kiss" other players to grow your family of baby squirrels—all in real time, built with Vite + Three.js and Express.js + Socket.IO. This spec outlines the simplest, most buildable version of the game.

- **Gameplay:**

  - Players control a sugar glider that glides between branches or runs up/down a single, infinitely high tree trunk.
  - Earn 1 point per second while gliding (not while on trunk or branches).
  - Vitality drains at 1% per second always (gliding or not); collecting berries on branches restores 50% vitality.
  - Berries spawn randomly on branches, one-time use (no respawn).
  - Touching the ground (y=0) or running out of vitality costs 1 baby squirrel. No babies + game-over = respawn at y=10 with full vitality.
  - Players “kiss” others within 2 units (both press a button, always visible) to gain a baby squirrel, shown with a simple heart animation.
  - Babies follow directly behind the player while gliding (like a tail) and cluster around them on branches or trunk.

- **World:**

  - One infinitely high tree trunk at x=0, z=0, with branches (2 units wide) extending horizontally at random x, z positions every 5 units up (e.g., y=5, 10, 15...).
  - Server generates branches in 20-unit-high chunks (e.g., 4 branches per chunk with random x, z offsets).
  - Static ground plane at y=0, 50 units below start, triggers baby loss on contact (no other response).
  - 1-2 berries spawn per chunk on random branches, synced to all players.

- **Multiplayer:**

  - Up to 100 players join a shared world randomly, seeing each other’s gliders and babies in real time.
  - Player positions update every 100ms (0.1 seconds) via Socket.IO.
  - All players see the same server-defined trunk, branches, and berries.

- **Technical:**

  - Frontend uses Vite + Three.js for 3D rendering.
  - Controls: mobile = tap to jump/glide, swipe to steer (or move up/down trunk); desktop = arrow keys to move.
  - Backend uses Express.js + Socket.IO to sync player positions and world state (trunk, branches, berries in memory, resets when all players disconnect).
  - Game runs in-browser, no install, no sound effects.

- **UI and Visuals:**
  - Vitality bar at top, score at bottom, kiss button in bottom-right corner (always visible).
  - Basic visuals: sugar glider as a sphere with wings, green trunk and branches, gray ground, red berry spheres.
