import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * Create a 3D scene with proper lighting and camera
 */
export const createScene = (container: HTMLElement) => {
  // Create scene
  const scene = new THREE.Scene()

  // Create camera
  const aspectRatio = window.innerWidth / window.innerHeight
  const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000)
  camera.position.set(10, 5, 10) // Start position
  camera.lookAt(0, 5, 0) // Look at center of scene

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  // Add lighting
  addLights(scene)

  // Setup controls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 5, 0)
  controls.update()

  // Handle window resizing
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  return {
    scene,
    camera,
    renderer,
    controls,
  }
}

/**
 * Add lights to the scene
 */
const addLights = (scene: THREE.Scene) => {
  // Add ambient light for general illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  // Add directional light for sun-like shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(50, 50, 30)
  directionalLight.castShadow = true

  // Adjust shadow properties for better quality
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 500

  const shadowSize = 100
  directionalLight.shadow.camera.left = -shadowSize
  directionalLight.shadow.camera.right = shadowSize
  directionalLight.shadow.camera.top = shadowSize
  directionalLight.shadow.camera.bottom = -shadowSize

  scene.add(directionalLight)

  // Add hemisphere light for natural outdoor lighting
  const hemisphereLight = new THREE.HemisphereLight(0x0088ff, 0x88aa55, 0.3)
  scene.add(hemisphereLight)

  return {
    ambientLight,
    directionalLight,
    hemisphereLight,
  }
}
