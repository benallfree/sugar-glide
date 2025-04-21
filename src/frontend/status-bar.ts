import { Berry } from './berry'
import { CommandSystem } from './command'

export interface StatusBarItem {
  id: string
  type: 'box' | 'toggle'
  value?: string | number
  default?: string | number | boolean
  onClick?: (e: MouseEvent) => void
  icon?: string
  iconOn?: string
  iconOff?: string
  valueOn?: string | number
  valueOff?: string | number
}

export interface StatusBarState {
  vitality: number
  berries: number
  wingLevel: number
  commandSystem: CommandSystem
  berry: Berry
  onWingUpgrade: (level: number) => void
  onBabySquirrel: () => void
  lockPointer: () => void
  unlockPointer: () => void
}

export type StatusBarDependencies = {
  toggleStore: () => void
  toggleMute: () => void
  toggleConsole: () => void
}

export const createStatusBar = (items: StatusBarItem[]) => {
  const statusBar = document.createElement('div')
  statusBar.id = 'status-bar'
  statusBar.className = 'status'

  items.forEach((item) => {
    const statusBox = document.createElement('div')
    statusBox.className = `status-box${item.type === 'toggle' ? ' status-toggle' : ''}`
    if (item.type === 'toggle' && item.default === true) {
      statusBox.classList.add('active')
    }
    if (item.onClick) {
      statusBox.addEventListener('click', (e) => {
        console.log('clicked')
        e.preventDefault()
        e.stopPropagation()
        item.onClick!(e)
        if (item.type === 'toggle') {
          statusBox.classList.toggle('active')
          const icon = statusBox.querySelector('.icon')
          if (icon) {
            icon.textContent = statusBox.classList.contains('active')
              ? item.iconOn || ''
              : item.iconOff || ''
          }
        }
      })
    }

    const icon = document.createElement('span')
    icon.className = 'icon'
    if (item.id === 'wing-icon') {
      icon.id = item.id
    }
    icon.textContent =
      item.type === 'toggle' && item.default === true
        ? item.iconOn || ''
        : item.iconOff || item.icon || ''

    statusBox.appendChild(icon)

    if (item.type === 'box' && item.value !== undefined) {
      const value = document.createElement('span')
      value.className = 'value'
      value.id = item.id
      value.textContent = item.value.toString()
      statusBox.appendChild(value)
    }

    statusBar.appendChild(statusBox)
  })

  return statusBar
}

export const updateStatusBarItem = (id: string, value: string | number) => {
  const element = document.getElementById(id)
  if (element) {
    element.textContent = value.toString()
  }
}

export const createStatusBarWithState = (
  state: StatusBarState,
  deps: StatusBarDependencies
) => {
  const statusBarItems: StatusBarItem[] = [
    {
      id: 'vitality-count',
      icon: '❤️',
      value: state.vitality,
      default: 100,
      type: 'box',
    },
    {
      id: 'berry-count',
      icon: '🫐',
      value: state.berries,
      default: 0,
      type: 'box',
    },
    {
      id: 'baby-count',
      icon: '🐿️',
      value: 0,
      default: 0,
      type: 'box',
    },
    {
      id: 'wing-level',
      icon: '🪽',
      value: state.wingLevel,
      default: 1,
      type: 'box',
    },
    {
      id: 'flight-time',
      icon: '⏱️',
      value: 0,
      default: '0.0',
      type: 'box',
    },
    {
      id: 'best-flight',
      icon: '🎯',
      value: 0,
      default: '0.0',
      type: 'box',
    },
    {
      id: 'store-button',
      iconOn: '💸',
      iconOff: '💸',
      type: 'toggle',
      onClick: () => deps.toggleStore(),
    },
    {
      id: 'mute-button',
      iconOn: '🔊',
      iconOff: '🔇',
      type: 'toggle',
      onClick: () => deps.toggleMute(),
      default: true,
    },
    {
      id: 'console-button',
      iconOn: '⌨️',
      iconOff: '⌨️',
      type: 'toggle',
      onClick: () => state.commandSystem.toggleConsole(),
    },
  ]

  const statusBar = createStatusBar(statusBarItems)
  document.body.appendChild(statusBar)

  const updateStatusBarToggle = (id: string, isOn: boolean) => {
    const element = document.getElementById(id)
    if (!element) return

    const statusBox = element.closest('.status-box')
    if (!statusBox) return

    const icon = statusBox.querySelector('.icon')
    if (!icon) return

    const item = statusBarItems.find((item: StatusBarItem) => item.id === id)
    if (!item || item.type !== 'toggle') return

    icon.textContent = isOn ? item.iconOn || '' : item.iconOff || ''
  }

  return {
    element: statusBar,
    updateToggle: updateStatusBarToggle,
  }
}
