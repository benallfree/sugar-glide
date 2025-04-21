export const addEventListener = <TDetail>(
  id: string,
  callback: (e: CustomEvent<TDetail>) => void
) => {
  document.addEventListener(id, callback as EventListener)
}

export const dispatchEvent = <TDetail>(id: string, detail?: TDetail) => {
  document.dispatchEvent(new CustomEvent(id, { detail }))
}

// Player Identity Events
export const PLAYER_IDENTITY_CHANGED = 'player-identity-changed'

export type PlayerIdentityChangeDetail = {
  oldId: string
  newId: string
}

export const onPlayerIdentityChanged = (
  callback: (e: CustomEvent<PlayerIdentityChangeDetail>) => void
) => {
  addEventListener<PlayerIdentityChangeDetail>(
    PLAYER_IDENTITY_CHANGED,
    callback
  )
}

export const emitPlayerIdentityChanged = (oldId: string, newId: string) => {
  dispatchEvent<PlayerIdentityChangeDetail>(PLAYER_IDENTITY_CHANGED, {
    oldId,
    newId,
  })
}
