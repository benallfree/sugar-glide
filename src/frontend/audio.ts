const createAudio = () => {
  // Audio setup
  let isMuted: boolean = false
  const berrySound: HTMLAudioElement = new Audio(
    '/fx/523655__matrixxx__powerup-09.mp3'
  )
  const babySound: HTMLAudioElement = new Audio(
    '/fx/99986__milton__music-bonus.mp3'
  )
  berrySound.volume = 0.3
  babySound.volume = 0.3

  let backgroundMusic: HTMLAudioElement

  function toggleMute() {
    isMuted = !isMuted
    backgroundMusic.volume = isMuted ? 0 : 0.2
    berrySound.volume = isMuted ? 0 : 0.3
    babySound.volume = isMuted ? 0 : 0.3
  }

  function playTrack(trackName: string) {
    const oldMusic = backgroundMusic
    backgroundMusic = new Audio(`/music/${trackName}`)
    backgroundMusic.loop = true
    backgroundMusic.volume = isMuted ? 0 : 0.2

    oldMusic?.pause()
    backgroundMusic.play().catch(() => {
      console.log('Audio playback failed')
    })
  }

  playTrack('background.mp3')

  function playBackgroundMusic() {
    return backgroundMusic.play().catch(() => {
      console.log('Audio playback failed')
    })
  }

  function playBerrySound() {
    berrySound.currentTime = 0
    berrySound.play().catch(() => {
      console.log('Sound effect playback failed')
    })
  }

  function playBabySound() {
    babySound.currentTime = 0
    babySound.play().catch(() => {
      console.log('Sound effect playback failed')
    })
  }

  function tryPlayMusicTrack(trackName: string): void {
    playTrack(trackName)
  }

  return {
    toggleMute,
    playTrack,
    playBackgroundMusic,
    tryPlayMusicTrack,
    playBerrySound,
    playBabySound,
  }
}

export const audio = createAudio()
