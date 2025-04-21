export default {
  root: './src/frontend',
  build: {
    outDir: '../../dist',
  },

  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
    allowedHosts: ['af9e-172-56-169-192.ngrok-free.app'],
  },
}
