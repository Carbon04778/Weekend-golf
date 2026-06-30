'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeHandicapIndex, RoundForHandicap } from '@/lib/handicap'

type Player = { id: string; full_name: string }
type League = { id: string; name: string }
type Round = {
  player_id: string
  date: string
  gross_score: number | null
  differential: number | null
  nine_hole_only: boolean
  outing_id: string | null
}
type Outing = { id: string; league_id: string | null }

export default function SeasonStatsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [allRounds, setAllRounds] = useState<Round[]>([])
  const [outings, setOutings] = useState<Outing[]>([])

  const [season, setSeason] = useState('all')
  const [leagueId, setLeagueId] = useState('all')
  const [playerId, setPlayerId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchPlayers(), fetchLeagues(), fetchRounds(), fetchOutings()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('id, full_name').order('full_name')
    setPlayers(data ?? [])
    if (data && data.length > 0) setPlayerId(data[0].id)
  }

  async function fetchLeagues() {
    const { data } = await supabase.from('leagues').select('id, name').order('name')
    setLeagues(data ?? [])
  }

  async function fetchRounds() {
    const { data } = await supabase
      .from('rounds')
      .select('player_id, date, gross_score, differential, nine_hole_only, outing_id')
    setAllRounds(data ?? [])
  }

  async function fetchOutings() {
    const { data } = await supabase.from('outings').select('id, league_id')
    setOutings(data ?? [])
  }

  // Years available, derived from real round dates (smart default: most recent year)
  const availableYears = [...new Set(allRounds.map((r) => r.date?.slice(0, 4)).filter(Boolean))]
    .sort()
    .reverse()

  function getOutingLeague(outingId: string | null) {
    return outings.find((o) => o.id === outingId)?.league_id ?? null
  }

  // Apply season + league filters, matching original's filtering logic
  const filteredRounds = allRounds.filter((r) => {
    if (season !== 'all' && !r.date?.startsWith(season)) return false
    if (leagueId !== 'all' && getOutingLeague(r.outing_id) !== leagueId) return false
    return true
  })

  const selectedPlayer = players.find((p) => p.id === playerId)
  const playerRounds = filteredRounds.filter((r) => r.player_id === playerId)

  // Only count rounds with a real gross score, matching the original's
  // "must be a full round, not a partial entry" guard
  const fullRounds = playerRounds.filter((r) => r.gross_score !== null && r.gross_score > 10)
  const avgGross = fullRounds.length > 0
    ? fullRounds.reduce((sum, r) => sum + (r.gross_score ?? 0), 0) / fullRounds.length
    : null
  const bestGross = fullRounds.length > 0
    ? Math.min(...fullRounds.map((r) => r.gross_score ?? Infinity))
    : null

  const handicapInput: RoundForHandicap[] = playerRounds.map((r) => ({
    date: r.date,
    differential: r.differential ?? 0,
    nineHoleOnly: r.nine_hole_only,
  }))
  const currentHI = computeHandicapIndex(handicapInput, null)

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px', maxWidth: '800px' }}>
      <h1>📈 Season Stats</h1>
      <p style={{ color: '#888', fontSize: '0.82rem', marginBottom: '20px' }}>
        Gross scoring shown for now — net scoring (using Course Handicap) and detailed
        eagle/birdie/par breakdowns are planned for a future update.
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.8rem', display: 'block' }}>Season</label>
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={{ padding: '6px' }}>
            <option value="all">All Time</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y} Season</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', display: 'block' }}>League</label>
          <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} style={{ padding: '6px' }}>
            <option value="all">All Leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', display: 'block' }}>Player</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ padding: '6px' }}>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedPlayer ? (
        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
          📈 Select a player above to view their season statistics.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
          }}
        >
          <div className="stat-card">
            <div className="label">Rounds Played</div>
            <div className="value">{fullRounds.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Average Gross</div>
            <div className="value">{avgGross !== null ? avgGross.toFixed(1) : '—'}</div>
          </div>
          <div className="stat-card">
            <div className="label">Best Round</div>
            <div className="value">{bestGross ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="label">Current H.I.</div>
            <div className="value">{currentHI !== null ? currentHI.toFixed(1) : '—'}</div>
          </div>
        </div>
      )}
    </main>
  )
}