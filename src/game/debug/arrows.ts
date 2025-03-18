import * as THREE from 'three'

const createDebugArrows = (scene: THREE.Scene) => {
  // Create the arrow helpers
  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    1,
    0xff0000
  )
  const upArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(),
    1,
    0x00ff00
  )
  const forwardArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(),
    1,
    0x0000ff
  )

  // Hide arrows by default
  normalArrow.visible = false
  upArrow.visible = false
  forwardArrow.visible = false

  // Add arrows to scene
  scene.add(normalArrow)
  scene.add(upArrow)
  scene.add(forwardArrow)

  const updateArrows = (
    position: THREE.Vector3,
    normal: THREE.Vector3,
    up: THREE.Vector3,
    forward: THREE.Vector3
  ) => {
    normalArrow.position.copy(position)
    upArrow.position.copy(position)
    forwardArrow.position.copy(position)

    normalArrow.setDirection(normal)
    upArrow.setDirection(up)
    forwardArrow.setDirection(forward)
  }

  const setArrowsVisible = (visible: boolean) => {
    normalArrow.visible = visible
    upArrow.visible = visible
    forwardArrow.visible = visible
  }

  const cleanup = () => {
    scene.remove(normalArrow)
    scene.remove(upArrow)
    scene.remove(forwardArrow)
  }

  return {
    updateArrows,
    setArrowsVisible,
    cleanup,
  }
}

export default createDebugArrows
