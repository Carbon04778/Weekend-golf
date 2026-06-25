'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Round = {
  id: string
  date: string
  course_name: string | null
  gross_score: number | null
  differential: number | null
  nine_hole_only: boolean
  player_id: string
}

type Player = { id: string; full_name: string }

export default function HistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rounds, setRounds] = useState<Round[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [filterPlayer, setFilterPlayer] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchRounds(), fetchPlayers()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchRounds() {
    const { data, error } = await supabase
      .from('rounds')
      .select('id, date, course_name, gross_score, differential, nine_hole_only, player_id')
      .order('date', { ascending: false })

    if (error) setError(error.message)
    else setRounds(data ?? [])
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('id, full_name').order('full_name')
    setPlayers(data ?? [])
  }

  function getPlayerName(id: string) {
    return players.find((p) => p.id === id)?.full_name ?? 'Unknown'
  }

  const visibleRounds = filterPlayer
    ? rounds.filter((r) => r.player_id === filterPlayer)
    : rounds

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <h1>Round History</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: '16px' }}>
        <label>Filter by Player: </label>
        <select value={filterPlayer} onChange={(e) => setFilterPlayer(e.target.value)} style={{ padding: '6px' }}>
          <option value="">All Players</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {visibleRounds.length === 0 ? (
        <p>No rounds recorded yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Player</th>
              <th style={{ padding: '8px' }}>Course</th>
              <th style={{ padding: '8px' }}>Gross</th>
              <th style={{ padding: '8px' }}>Differential</th>
              <th style={{ padding: '8px' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {visibleRounds.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{r.date}</td>
                <td style={{ padding: '8px' }}>{getPlayerName(r.player_id)}</td>
                <td style={{ padding: '8px' }}>{r.course_name ?? '-'}</td>
                <td style={{ padding: '8px' }}>{r.gross_score ?? '-'}</td>
                <td style={{ padding: '8px' }}>{r.differential ?? '-'}</td>
                <td style={{ padding: '8px' }}>{r.nine_hole_only ? '9-hole' : '18-hole'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}