'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeHandicapIndex, RoundForHandicap } from '@/lib/handicap'

type RankedPlayer = {
  id: string
  full_name: string
  home_club: string | null
  handicapIndex: number | null
  roundCount: number
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<RankedPlayer[]>([])
  const [stats, setStats] = useState({ outings: 0, rounds: 0, activePlayers: 0, avgHI: null as number | null })

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchDashboardData()
      setLoading(false)
    }
    checkUser()
  }, [router])

  async function fetchDashboardData() {
    const { data: playerRows } = await supabase
      .from('players')
      .select('id, full_name, home_club, manual_hi')

    const { data: roundRows } = await supabase
      .from('rounds')
      .select('player_id, date, differential, nine_hole_only')

    const { count: outingCount } = await supabase
      .from('outings')
      .select('*', { count: 'exact', head: true })

    const ranked: RankedPlayer[] = (playerRows ?? []).map((p) => {
      const playerRounds: RoundForHandicap[] = (roundRows ?? [])
        .filter((r) => r.player_id === p.id)
        .map((r) => ({ date: r.date, differential: r.differential, nineHoleOnly: r.nine_hole_only }))

      return {
        id: p.id,
        full_name: p.full_name,
        home_club: p.home_club,
        handicapIndex: computeHandicapIndex(playerRounds, p.manual_hi),
        roundCount: playerRounds.length,
      }
    })

    ranked.sort((a, b) => {
      if (a.handicapIndex === null && b.handicapIndex === null) return 0
      if (a.handicapIndex === null) return 1
      if (b.handicapIndex === null) return -1
      return a.handicapIndex - b.handicapIndex
    })

    setLeaderboard(ranked)

    const activePlayers = ranked.filter((p) => p.roundCount > 0).length
    const validHIs = ranked.map((p) => p.handicapIndex).filter((h): h is number => h !== null)
    const avgHI = validHIs.length > 0 ? validHIs.reduce((a, b) => a + b, 0) / validHIs.length : null

    setStats({
      outings: outingCount ?? 0,
      rounds: roundRows?.length ?? 0,
      activePlayers,
      avgHI,
    })
  }

  function medal(rank: number) {
    if (rank === 0) return '🏆'
    if (rank === 1) return '🥈'
    if (rank === 2) return '🥉'
    return `${rank + 1}`
  }

  function initials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div
        className="stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="stat-card">
          <div className="label">Total Outings</div>
          <div className="value">{stats.outings}</div>
          <div className="sub">All leagues</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Rounds</div>
          <div className="value">{stats.rounds}</div>
          <div className="sub">Rounds posted</div>
        </div>
        <div className="stat-card">
          <div className="label">Active Players</div>
          <div className="value">{stats.activePlayers}</div>
          <div className="sub">With rounds posted</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg H.I.</div>
          <div className="value">{stats.avgHI !== null ? stats.avgHI.toFixed(1) : '—'}</div>
          <div className="sub">All players</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow)', padding: '24px' }}>
        <h2 style={{ color: 'var(--green-dark)', fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🏆 Handicap Index Leaderboard
        </h2>

        {leaderboard.length === 0 ? (
          <p style={{ color: 'var(--gray)' }}>No players yet.</p>
        ) : (
          leaderboard.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 0',
                borderBottom: i < leaderboard.length - 1 ? '1px solid #eee' : 'none',
              }}
            >
              <div style={{ width: '28px', textAlign: 'center', fontSize: i < 3 ? '1.2rem' : '0.9rem', fontWeight: 700, color: 'var(--green-dark)' }}>
                {medal(i)}
              </div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--green-dark)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {initials(p.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{p.full_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray)' }}>{p.home_club ?? 'No home club'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: 'var(--green-dark)', fontSize: '1.1rem' }}>
                  {p.handicapIndex !== null ? p.handicapIndex.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gray)' }}>{p.roundCount} rounds</div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}