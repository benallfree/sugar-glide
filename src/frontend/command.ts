import { Berry } from './berry'
import { updateDebugVisibility } from './tree'

export interface CommandDependencies {
  berry: Berry
  vitality: number
  updateVitality: (value: number) => void
  createBabySquirrel: (playerId: string) => void
  getLocalPlayerId: () => string
  handlePointerLock: () => void
  unlockPointer: () => void
  toggleMute: () => void
  toggleStore: () => void
}

// Add global debug state
let isDebugMode = false

export interface ConsoleElements {
  input: HTMLInputElement
  element: HTMLDivElement
}

export interface VibeCommand {
  defaultQty: number
  description: string
  handler: (qty: number, deps: CommandDependencies) => void
}

export interface CommandSystem {
  commands: Record<string, VibeCommand>
  handleCommand: (command: string) => string
  setupConsole: (elements: ConsoleElements) => void
  handleKeyDown: (event: KeyboardEvent) => void
  toggleConsole: () => void
}

export const createVibeCommands = (
  deps: CommandDependencies
): CommandSystem => {
  const commands: Record<string, VibeCommand> = {
    nom: {
      defaultQty: 10,
      description: 'berries',
      handler: (qty) => {
        deps.berry.add(qty)
      },
    },
    bb: {
      defaultQty: 3,
      description: 'baby squirrels',
      handler: (qty) => {
        for (let i = 0; i < qty; i++) {
          deps.createBabySquirrel(deps.getLocalPlayerId())
        }
      },
    },
    stronk: {
      defaultQty: 100,
      description: 'vitality',
      handler: (qty) => {
        deps.vitality += qty
        deps.updateVitality(deps.vitality)
      },
    },
    dbg: {
      defaultQty: 1,
      description: 'debug mode',
      handler: () => {
        isDebugMode = !isDebugMode
        updateDebugVisibility(isDebugMode)
      },
    },
  }

  const handleCommand = (command: string): string => {
    const types = Object.keys(commands).join('|')
    const pattern = new RegExp(`^vibe(${types})([0-9]+)?$`)
    const match = command.match(pattern)

    if (!match) {
      const examples = Object.keys(commands)
        .map((type) => `/vibe${type}[N]`)
        .join(' or ')
      return `Invalid command format. Use ${examples} where N is optional quantity`
    }

    const [, type, qty] = match
    const cmd = commands[type]
    const amount = parseInt(qty) || cmd.defaultQty

    cmd.handler(amount, deps)
    return `Added ${amount} ${cmd.description}!`
  }

  let isConsoleOpen = false
  let consoleElements: ConsoleElements | null = null

  const openConsole = () => {
    if (!consoleElements) return
    isConsoleOpen = true
    deps.unlockPointer()
    consoleElements.element.classList.add('visible')
    consoleElements.input.focus()
  }

  const closeConsole = () => {
    if (!consoleElements) return
    isConsoleOpen = false
    deps.handlePointerLock()
    consoleElements.element.classList.remove('visible')
  }

  const toggleConsole = () => {
    if (!consoleElements) return
    if (isConsoleOpen) {
      closeConsole()
    } else {
      openConsole()
    }
  }

  const setupConsole = (elements: ConsoleElements) => {
    consoleElements = elements
    const commandMap: Record<string, (command: string) => string> = {}
    Object.keys(commands).forEach((type) => {
      commandMap[`vibe${type}`] = handleCommand
    })

    elements.input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const command = elements.input.value.trim()
        elements.input.value = ''

        const baseCmd = command.replace(/[0-9]+$/, '')
        const handler = commandMap[baseCmd]

        if (handler) {
          const result = handler(command)
          console.log({ result })
        } else {
          console.log('Unknown command')
        }

        closeConsole()
      } else if (event.key === 'Escape') {
        closeConsole()
      }
      event.stopPropagation()
    })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'm' || event.key === 'M') {
      deps.toggleMute()
    } else if (event.key === '/' && !isConsoleOpen) {
      event.preventDefault()
      openConsole()
      return
    } else if (event.code === 'KeyB') {
      deps.toggleStore()
    }
  }

  return {
    commands,
    handleCommand,
    setupConsole,
    handleKeyDown,
    toggleConsole,
  }
}
