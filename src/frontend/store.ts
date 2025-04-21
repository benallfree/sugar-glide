import { audio } from './audio'
import { Berry } from './berry'
import { MusicTrack, WingUpgrade } from './types'

export const WING_UPGRADES: WingUpgrade[] = [
  { level: 1, cost: 0, glideStrength: 3, icon: '🪽' },
  { level: 2, cost: 5, glideStrength: 2, icon: '🦅' },
  { level: 3, cost: 15, glideStrength: 1, icon: '🦅🦅' },
] as const

const MUSIC_TRACKS: Record<string, MusicTrack> = {
  'Flying High - Glider Squirrel Anthem.mp3': { cost: 10, owned: false },
  'Glider Squirrels in the Sky.mp3': { cost: 15, owned: false },
  'Gliding Hearts.mp3': { cost: 20, owned: false },
  'Gliding High.mp3': { cost: 25, owned: false },
} as const

interface StoreItem {
  id: string
  title: string
  description: string
  cost: number
  onClick: (store: any) => void
}

interface StoreSection {
  title: string
  items: StoreItem[]
}

interface StoreDependencies {
  berry: Berry
  onWingUpgrade: (level: number) => void
  onBabySquirrel: () => void
  lockPointer: () => void
  unlockPointer: () => void
}

const STORE_SECTIONS: StoreSection[] = [
  {
    title: 'Wing Upgrades',
    items: WING_UPGRADES.slice(1).map((upgrade) => ({
      id: `wing-${upgrade.level}`,
      title: `Level ${upgrade.level} Wings`,
      description: 'Better gliding',
      cost: upgrade.cost,
      onClick: (store) => store.buyWingUpgrade(upgrade.level),
    })),
  },
  {
    title: 'Baby Squirrels',
    items: [
      {
        id: 'baby-squirrel',
        title: 'Baby Squirrel',
        description: 'A tiny companion',
        cost: 20,
        onClick: (store) => store.buyBabySquirrel(),
      },
    ],
  },
  {
    title: 'Music Tracks',
    items: Object.entries(MUSIC_TRACKS).map(([track, data]) => ({
      id: `music-${track}`,
      title: track.replace('.mp3', ''),
      description: 'A new musical adventure',
      cost: data.cost,
      onClick: (store) => {
        if (store.buyMusicTrack(track)) {
          audio.tryPlayMusicTrack(track)
        }
      },
    })),
  },
]

export const createStore = (deps: StoreDependencies) => {
  let isVisible = false
  let storeElement: HTMLDivElement | null = null

  function buyMusicTrack(trackName: string): boolean {
    const track = MUSIC_TRACKS[trackName]
    if (!track) return false

    if (track.owned) {
      return true
    } else if (deps.berry.getCount() >= track.cost) {
      deps.berry.add(-track.cost)
      track.owned = true
      return true
    }
    return false
  }

  function createStoreElement() {
    const store = document.createElement('div')
    store.id = 'store'

    STORE_SECTIONS.forEach((section) => {
      const sectionElement = document.createElement('div')
      sectionElement.innerHTML = `<h2>${section.title}</h2>`

      const itemsContainer = document.createElement('div')
      itemsContainer.className = 'store-items'

      section.items.forEach((item) => {
        const itemElement = document.createElement('div')
        itemElement.className = 'store-item'
        itemElement.innerHTML = `
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <p>Cost: ${item.cost} berries</p>
        `
        itemElement.addEventListener('click', () => {
          if (deps.berry.getCount() >= item.cost) {
            item.onClick(api)
          }
        })
        itemsContainer.appendChild(itemElement)
      })

      sectionElement.appendChild(itemsContainer)
      store.appendChild(sectionElement)
    })

    return store
  }
  console.log('createstore', new Error().stack)
  function toggleVisibility() {
    if (!storeElement) {
      storeElement = createStoreElement()
      document.body.appendChild(storeElement)
    }
    if (isVisible) {
      storeElement.classList.remove('visible')
    } else {
      storeElement.classList.add('visible')
      deps.unlockPointer()
    }
    isVisible = !isVisible
    console.log('toggleVisibility', { isVisible })
  }

  function buyWingUpgrade(level: number): void {
    const upgrade = WING_UPGRADES.find((u) => u.level === level)
    if (upgrade && deps.berry.getCount() >= upgrade.cost) {
      deps.berry.add(-upgrade.cost)
      deps.onWingUpgrade(level)
    }
  }

  function buyBabySquirrel(): void {
    const cost = 20
    if (deps.berry.getCount() >= cost) {
      deps.berry.add(-cost)
      deps.onBabySquirrel()
    }
  }

  const api = {
    toggleVisibility,
    buyWingUpgrade,
    buyBabySquirrel,
    buyMusicTrack,
  }

  return api
}
