import * as THREE from 'three'

/**
 * Create the world environment with ground and tree trunk
 */
export const createWorld = (scene: THREE.Scene) => {
  // Create skybox
  const createSkybox = () => {
    // Create a gradient sky using a large sphere with inside-facing normals
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32)

    // Create a shader material for the sky with a gradient
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) }, // Blue
        bottomColor: { value: new THREE.Color(0xffffff) }, // White at horizon
        offset: { value: 400 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    })

    const sky = new THREE.Mesh(skyGeometry, skyMaterial)
    scene.add(sky)
    return sky
  }

  // Create ground plane with grid texture
  const createGround = () => {
    // Create a large ground plane
    const groundSize = 1000
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32)

    // Create a checkered texture for better spatial awareness
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x88aa55, // Green-brown for grass
      roughness: 0.9,
      metalness: 0.0,
    })

    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2 // Rotate to horizontal
    ground.position.y = 0 // At y=0
    ground.receiveShadow = true

    // Add a grid helper for better orientation
    const gridHelper = new THREE.GridHelper(groundSize, 100, 0x000000, 0x444444)
    gridHelper.position.y = 0.01 // Slightly above ground to prevent z-fighting
    scene.add(gridHelper)

    // Add fog for depth perception
    scene.fog = new THREE.FogExp2(0xccccff, 0.0025)

    scene.add(ground)
    return ground
  }

  // Create infinite tree trunk
  const createTreeTrunk = () => {
    const segments = 20 // Increased segments for smoother appearance
    const trunkHeight = 1000 // Very tall trunk
    const trunkRadius = 3

    // Create tree trunk geometry
    const trunkGeometry = new THREE.CylinderGeometry(
      trunkRadius, // top radius
      trunkRadius + 1, // bottom radius (slightly wider)
      trunkHeight,
      segments
    )

    // Create more realistic bark texture
    const textureLoader = new THREE.TextureLoader()
    const barkTexture = createBarkTexture()

    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Base color
      roughness: 1.0,
      metalness: 0.0,
      map: barkTexture, // Add generated texture
      bumpScale: 0.5,
    })

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.set(0, trunkHeight / 2, 0) // Center at origin, extending upward
    trunk.castShadow = true
    trunk.receiveShadow = true

    // Add markers at intervals to help with visual height perception
    for (let y = 0; y < trunkHeight; y += 20) {
      const marker = createHeightMarker(y)
      scene.add(marker)
    }

    scene.add(trunk)
    return trunk
  }

  // Create a procedural bark texture
  const createBarkTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return null

    // Fill with base color
    context.fillStyle = '#8B4513'
    context.fillRect(0, 0, 256, 256)

    // Add vertical bark lines
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 256
      const width = 5 + Math.random() * 15

      context.fillStyle = `rgba(60, 30, 15, ${0.3 + Math.random() * 0.7})`
      context.fillRect(x, 0, width, 256)
    }

    // Add horizontal cracks
    for (let i = 0; i < 10; i++) {
      const y = Math.random() * 256
      const width = 50 + Math.random() * 150
      const x = Math.random() * 100

      context.fillStyle = `rgba(30, 15, 5, ${0.3 + Math.random() * 0.4})`
      context.fillRect(x, y, width, 1 + Math.random() * 3)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 16) // Repeat to cover the trunk

    return texture
  }

  // Create height marker rings around the trunk
  const createHeightMarker = (height: number) => {
    const radius = 3.2 // Slightly larger than trunk
    const geometry = new THREE.TorusGeometry(radius, 0.1, 8, 24)
    const material = new THREE.MeshBasicMaterial({
      color: height % 100 === 0 ? 0xff0000 : 0xffff00,
    })

    const ring = new THREE.Mesh(geometry, material)
    ring.position.set(0, height, 0)
    ring.rotation.x = Math.PI / 2 // Horizontal orientation

    return ring
  }

  // Create and return world elements
  const sky = createSkybox()
  const ground = createGround()
  const trunk = createTreeTrunk()

  return {
    sky,
    ground,
    trunk,
  }
}
