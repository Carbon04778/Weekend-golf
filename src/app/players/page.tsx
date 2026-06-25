'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeHandicapIndex, RoundForHandicap } from '@/lib/handicap'

type Player = {
  id: string
  full_name: string
  email: string | null
  ghin: string | null
  home_club: string | null
  manual_hi: number | null
  handicapIndex: number | null
}

export default function PlayersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchPlayers()
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchPlayers() {
    const { data: playerRows, error: playerError } = await supabase
      .from('players')
      .select('id, full_name, email, ghin, home_club, manual_hi')
      .order('full_name')

    if (playerError) {
      setError(playerError.message)
      return
    }

    const { data: roundRows } = await supabase
      .from('rounds')
      .select('player_id, date, differential, nine_hole_only')

    const enriched: Player[] = (playerRows ?? []).map((p) => {
      const playerRounds: RoundForHandicap[] = (roundRows ?? [])
        .filter((r) => r.player_id === p.id)
        .map((r) => ({
          date: r.date,
          differential: r.differential,
          nineHoleOnly: r.nine_hole_only,
        }))

      const handicapIndex = computeHandicapIndex(playerRounds, p.manual_hi)

      return { ...p, handicapIndex }
    })

    setPlayers(enriched)
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { error } = await supabase
      .from('players')
      .insert({ full_name: newName, email: newEmail || null })

    if (error) {
      setError(error.message)
    } else {
      setNewName('')
      setNewEmail('')
      setShowAddForm(false)
      await fetchPlayers()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this player?')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      await fetchPlayers()
    }
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Player Roster</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '8px 16px' }}>
          {showAddForm ? 'Cancel' : '+ Add Player'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddPlayer} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '12px' }}>
            <label>Full Name *</label><br />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Email</label><br />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Save Player</button>
        </form>
      )}

      {players.length === 0 ? (
        <p>No players yet. Click &quot;Add Player&quot; to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Email</th>
              <th style={{ padding: '8px' }}>GHIN</th>
              <th style={{ padding: '8px' }}>Home Club</th>
              <th style={{ padding: '8px' }}>H.I.</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{p.full_name}</td>
                <td style={{ padding: '8px' }}>{p.email ?? '-'}</td>
                <td style={{ padding: '8px' }}>{p.ghin ?? '-'}</td>
                <td style={{ padding: '8px' }}>{p.home_club ?? '-'}</td>
                <td style={{ padding: '8px' }}>
                  {p.handicapIndex !== null ? p.handicapIndex.toFixed(1) : 'No H.I.'}
                </td>
                <td style={{ padding: '8px' }}>
                  <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 8px' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}