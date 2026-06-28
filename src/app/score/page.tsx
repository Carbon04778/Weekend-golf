'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateDifferential } from '@/lib/handicap'

type Outing = {
  id: string
  date: string
  holes_to_play: string
  par: number | null
  course_rating: number | null
  slope_rating: number | null
  course_id: string | null
}

type Player = { id: string; full_name: string }
type HolePar = { hole: number; par: number; si: number }

export default function ScoreEntryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [outings, setOutings] = useState<Outing[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [holeConfig, setHoleConfig] = useState<HolePar[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [outingId, setOutingId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [holeScores, setHoleScores] = useState<string[]>(Array(18).fill(''))

  const selectedOuting = outings.find((o) => o.id === outingId)
  const holesToPlay = selectedOuting?.holes_to_play ?? '18'

  const visibleHoles =
    holesToPlay === 'front9' ? [1,2,3,4,5,6,7,8,9] :
    holesToPlay === 'back9' ? [10,11,12,13,14,15,16,17,18] :
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]

  // Real per-hole par if we have it configured for this course, otherwise null
  function getHolePar(hole: number): number | null {
    const found = holeConfig.find((h) => h.hole === hole)
    return found ? found.par : null
  }

  const hasRealHoleConfig = holeConfig.length === 18

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchOutings(), fetchPlayers()])
      setLoading(false)
    }
    load()
  }, [router])

  // Whenever the selected outing changes, fetch that course's real hole config
  useEffect(() => {
    async function fetchHoleConfig() {
      if (!selectedOuting?.course_id) {
        setHoleConfig([])
        return
      }
      const { data } = await supabase
        .from('course_holes')
        .select('hole, par, si')
        .eq('course_id', selectedOuting.course_id)
        .order('hole')
      setHoleConfig(data ?? [])
    }
    fetchHoleConfig()
  }, [selectedOuting?.course_id])

  async function fetchOutings() {
    const { data } = await supabase
      .from('outings')
      .select('id, date, holes_to_play, par, course_rating, slope_rating, course_id')
      .order('date', { ascending: false })
    setOutings(data ?? [])
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('id, full_name').order('full_name')
    setPlayers(data ?? [])
  }

  function updateHole(holeNumber: number, value: string) {
    const updated = [...holeScores]
    updated[holeNumber - 1] = value
    setHoleScores(updated)
  }

  const grossTotal = visibleHoles.reduce((sum, h) => {
    const v = parseInt(holeScores[h - 1])
    return sum + (isNaN(v) ? 0 : v)
  }, 0)

  // Real per-hole par total for just the holes being played, falling back to
  // the outing's flat par if no real per-hole config exists (gotcha #1 precedence)
  const realParTotal = hasRealHoleConfig
    ? visibleHoles.reduce((sum, h) => sum + (getHolePar(h) ?? 0), 0)
    : null

  async function handleSaveScore(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!selectedOuting) {
      setError('Please select an outing.')
      return
    }
    if (!selectedOuting.course_rating || !selectedOuting.slope_rating || !selectedOuting.par) {
      setError('This outing is missing course rating, slope, or par. Edit the outing first.')
      return
    }

    const isNineHole = holesToPlay !== '18'
    const numHoles = visibleHoles.length

    // Use the real per-hole par total when we have it (course config),
    // otherwise fall back to the outing's flat par value — same precedence
    // rule as the original app's ssOutingHoles().
    const effectivePar = realParTotal ?? (isNineHole ? Math.round(selectedOuting.par / 2) : selectedOuting.par)

    const differential = calculateDifferential(
      grossTotal,
      numHoles,
      effectivePar,
      selectedOuting.course_rating,
      selectedOuting.slope_rating,
      isNineHole
    )

    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .insert({
        player_id: playerId,
        outing_id: selectedOuting.id,
        date: selectedOuting.date,
        course_rating: selectedOuting.course_rating,
        slope_rating: selectedOuting.slope_rating,
        par: effectivePar,
        gross_score: grossTotal,
        nine_hole_only: isNineHole,
        nine_hole_which: holesToPlay === 'front9' ? 'front' : holesToPlay === 'back9' ? 'back' : null,
        differential,
        source: 'outing',
      })
      .select()
      .single()

    if (roundError) {
      setError(roundError.message)
      return
    }

    const holeRows = visibleHoles
      .filter((h) => holeScores[h - 1] !== '')
      .map((h) => ({
        outing_id: selectedOuting.id,
        player_id: playerId,
        hole: h,
        gross: parseInt(holeScores[h - 1]),
      }))

    if (holeRows.length > 0) {
      const { error: holeError } = await supabase.from('outing_hole_scores').insert(holeRows)
      if (holeError) {
        setError(holeError.message)
        return
      }
    }

    setMessage(`Score saved! Differential: ${differential}`)
    setHoleScores(Array(18).fill(''))
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px', maxWidth: '700px' }}>
      <h1>Enter Score</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <form onSubmit={handleSaveScore}>
        <div style={{ marginBottom: '12px' }}>
          <label>Outing *</label><br />
          <select value={outingId} onChange={(e) => setOutingId(e.target.value)} required style={{ width: '100%', padding: '8px' }}>
            <option value="">— Select Outing —</option>
            {outings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.date} ({o.holes_to_play})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Player *</label><br />
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} required style={{ width: '100%', padding: '8px' }}>
            <option value="">— Select Player —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        {selectedOuting && (
          <>
            <p style={{ fontSize: '0.85rem', color: '#666' }}>
              Par {realParTotal ?? selectedOuting.par ?? '-'} · Rating {selectedOuting.course_rating ?? '-'} · Slope {selectedOuting.slope_rating ?? '-'}
              {hasRealHoleConfig
                ? ' · ✓ using real per-hole par data'
                : ' · ⚠ no per-hole config set, using flat outing par'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '6px', marginBottom: '12px' }}>
              {visibleHoles.map((h) => (
                <div key={h} style={{ textAlign: 'center' }}>
                  <label style={{ fontSize: '0.75rem' }}>
                    H{h}{hasRealHoleConfig ? <span style={{ color: '#888' }}> (par {getHolePar(h)})</span> : null}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={holeScores[h - 1]}
                    onChange={(e) => updateHole(h, e.target.value)}
                    style={{ width: '100%', padding: '6px', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>

            <p><strong>Gross Total: {grossTotal}</strong></p>
          </>
        )}

        <button type="submit" style={{ padding: '8px 16px' }}>Save Score</button>
      </form>
    </main>
  )
}