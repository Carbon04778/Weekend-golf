// Ported faithfully from golf-handicap-tracker.2026.06.20.html
// Source functions: applyMaxScore, build18HoleDiffs, whsHI, computeHI

export type RoundForHandicap = {
  date: string
  differential: number
  nineHoleOnly: boolean
}

/**
 * Caps a gross score so an unusually bad round doesn't distort the
 * handicap calculation. This mirrors the original app's simplified
 * version of the "Net Double Bogey" rule (a flat cap, not per-hole).
 * Example: 18 holes at par 72 -> max counted score is 72 + 36 = 108.
 */
export function applyMaxScore(gross: number, holes: number, par: number): number {
  return Math.min(gross, par + holes * 2)
}

/**
 * Calculates a single round's handicap differential.
 * Standard USGA/World Handicap System formula:
 *   (adjusted gross score - course rating) * 113 / slope rating
 */
export function calculateDifferential(
  grossScore: number,
  holes: number,
  par: number,
  courseRating: number,
  slopeRating: number,
  nineHoleOnly: boolean
): number {
  const effectiveRating = nineHoleOnly ? courseRating / 2 : courseRating
  const adjustedGross = applyMaxScore(grossScore, holes, par)
  const differential = ((adjustedGross - effectiveRating) * 113) / slopeRating
  return parseFloat(differential.toFixed(1))
}

/**
 * WHS Rule 34-3: pairs up two 9-hole round differentials (oldest first)
 * into one 18-hole-equivalent differential. A leftover unpaired 9-hole
 * round is excluded until a second 9-hole round exists to pair with it.
 */
export function build18HoleDiffs(rounds: RoundForHandicap[]): number[] {
  const full: RoundForHandicap[] = []
  const nine: RoundForHandicap[] = []

  rounds.forEach((r) => (r.nineHoleOnly ? nine : full).push(r))

  nine.sort((a, b) => a.date.localeCompare(b.date))

  const combined: number[] = []
  for (let i = 0; i + 1 < nine.length; i += 2) {
    combined.push(nine[i].differential + nine[i + 1].differential)
  }

  return [...full.map((r) => r.differential), ...combined]
}

/**
 * WHS Rule 5.2: official USGA table mapping "number of differentials
 * available" to "how many of the best ones to average" plus any
 * adjustment penalty for having very few rounds on file.
 */
export function whsHI(diffs: number[]): number | null {
  const n = diffs.length
  if (n < 3) return null

  let count: number
  let adj = 0

  if (n >= 20) count = 8
  else if (n >= 19) count = 7
  else if (n >= 17) count = 6
  else if (n >= 15) count = 5
  else if (n >= 12) count = 4
  else if (n >= 9) count = 3
  else if (n >= 7) count = 2
  else if (n >= 6) { count = 2; adj = 1.0 }
  else if (n >= 5) count = 1
  else if (n === 4) { count = 1; adj = 1.0 }
  else { count = 1; adj = 2.0 }

  const sorted = [...diffs].sort((a, b) => a - b)
  const best = sorted.slice(0, count)
  const average = best.reduce((a, b) => a + b, 0) / count

  return Math.trunc((average - adj) * 10) / 10
}

/**
 * Computes a player's current Handicap Index from their most recent
 * rounds (max 20 considered, matching the original app). Falls back
 * to their manually-entered "Starter H.I." if they don't have enough
 * rounds yet for a real calculation.
 */
export function computeHandicapIndex(
  rounds: RoundForHandicap[],
  manualHI: number | null
): number | null {
  if (rounds.length === 0) return manualHI

  const sorted = [...rounds].sort((a, b) => b.date.localeCompare(a.date))
  const recentRounds = sorted.slice(0, 20)
  const diffs = build18HoleDiffs(recentRounds)

  const result = whsHI(diffs)
  return result ?? manualHI
}