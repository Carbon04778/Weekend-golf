'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type League = {
  id: string
  name: string
  description: string | null
}

type Player = {
  id: string
  full_name: string
}

export default function LeaguesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [leagues, setLeagues] = useState<League[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchLeagues(), fetchPlayers()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchLeagues() {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, name, description')
      .order('name')

    if (error) {
      setError(error.message)
    } else {
      setLeagues(data ?? [])
    }
  }

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('id, full_name')
      .order('full_name')
    setPlayers(data ?? [])
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleAddLeague(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        description: description || null,
        owner_id: session?.user.id ?? null,
      })
      .select()
      .single()

    if (leagueError) {
      setError(leagueError.message)
      return
    }

    if (selectedPlayers.length > 0) {
      const memberRows = selectedPlayers.map((playerId) => ({
        league_id: leagueData.id,
        player_id: playerId,
      }))
      const { error: memberError } = await supabase.from('league_members').insert(memberRows)
      if (memberError) {
        setError(memberError.message)
        return
      }
    }

    setName('')
    setDescription('')
    setSelectedPlayers([])
    setShowAddForm(false)
    await fetchLeagues()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this league?')) return
    const { error } = await supabase.from('leagues').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      await fetchLeagues()
    }
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Leagues</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '8px 16px' }}>
          {showAddForm ? 'Cancel' : '+ Create League'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddLeague} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '12px' }}>
            <label>League Name *</label><br />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Saturday Morning Golfers"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Description</label><br />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label><strong>Members</strong></label>
            <div style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '10px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {players.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>No players yet — add players first.</p>
              ) : (
                players.map((p) => (
                  <label key={p.id} style={{ display: 'block', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(p.id)}
                      onChange={() => togglePlayer(p.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {p.full_name}
                  </label>
                ))
              )}
            </div>
          </div>
          <button type="submit" style={{ padding: '8px 16px' }}>Save League</button>
        </form>
      )}

      {leagues.length === 0 ? (
        <p>No leagues yet. Click &quot;Create League&quot; to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Description</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{l.name}</td>
                <td style={{ padding: '8px' }}>{l.description ?? '-'}</td>
                <td style={{ padding: '8px' }}>
                  <button onClick={() => handleDelete(l.id)} style={{ padding: '4px 8px' }}>
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