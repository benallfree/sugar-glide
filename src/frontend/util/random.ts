// Mulberry32 is a simple and fast 32-bit seeded random number generator
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function createSeededRandom(seed: number) {
  const random = mulberry32(seed)
  return {
    float: () => random(),
    range: (min: number, max: number) => min + random() * (max - min),
    int: (min: number, max: number) =>
      Math.floor(min + random() * (max - min + 1)),
    shuffle: <T>(array: T[]): T[] => {
      const result = [...array]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    },
  }
}
