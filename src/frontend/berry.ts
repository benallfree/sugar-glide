interface BerryDependencies {
  playBerrySound: () => void
  onBerryCountChange: (count: number) => void
}

export interface Berry {
  getCount: () => number
  add: (amount: number) => void
}

export const createBerry = (deps: BerryDependencies): Berry => {
  let count = 0

  function getCount(): number {
    return count
  }

  function add(amount: number): void {
    count = Math.max(0, count + amount)
    if (amount > 0) {
      deps.playBerrySound()
    }
    deps.onBerryCountChange(count)
  }

  return {
    getCount,
    add,
  }
}
