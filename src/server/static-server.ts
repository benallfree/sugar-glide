import express from 'express'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/**
 * Create a static file server for production.
 * This will serve the Vite-built frontend.
 */
const createStaticServer = (app: express.Express) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  // Path to the public directory and built frontend
  const webRoot = join(__dirname, '..', '..', 'dist')

  // Serve static files from the Vite build
  app.use(express.static(webRoot))

  return app
}

export default createStaticServer
