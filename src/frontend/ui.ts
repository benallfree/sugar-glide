import nipplejs from 'nipplejs'

const createUI = () => {
  let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  // Mobile UI Elements
  const mobileControls = document.createElement('div')
  mobileControls.id = 'mobile-controls'
  mobileControls.innerHTML = `
    <div class="joystick-container">
      <div id="move-joystick-zone"></div>
      <div class="joystick-label">MOVE</div>
    </div>
    <div class="mobile-buttons">
      <button id="mobile-climb">Climb</button>
    </div>
    <div class="joystick-container">
      <div id="look-joystick-zone"></div>
      <div class="joystick-label">LOOK</div>
    </div>
  `

  if (isMobile) {
    document.body.appendChild(mobileControls)
    document.body.classList.add('mobile')

    // Setup movement joystick
    const moveJoystick = nipplejs.create({
      zone: document.getElementById('move-joystick-zone')!,
      mode: 'static',
      position: { left: '60px', top: '60px' },
      color: 'white',
      size: 120,
      restOpacity: 0.5,
      fadeTime: 100,
    })

    // Setup look joystick
    const lookJoystick = nipplejs.create({
      zone: document.getElementById('look-joystick-zone')!,
      mode: 'static',
      position: { right: '60px', top: '60px' },
      color: 'white',
      size: 120,
      restOpacity: 0.5,
      fadeTime: 100,
    })

    // Setup touch events
    let climbButton = document.getElementById('mobile-climb')!

    // Prevent default touch events
    const preventScroll = (e: TouchEvent) => e.preventDefault()
    climbButton.addEventListener('touchstart', preventScroll)

    return {
      isMobile,
      moveJoystick,
      lookJoystick,
      climbButton,
    }
  }

  return {
    isMobile,
    moveJoystick: null,
    lookJoystick: null,
    climbButton: null,
    storeButton: null,
  }
}

export const ui = createUI()
