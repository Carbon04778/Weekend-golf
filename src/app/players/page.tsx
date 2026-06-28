'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeHandicapIndex, RoundForHandicap } from '@/lib/handicap'

const US_STATES = [
  'AK','AL','AR','AZ','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS',
  'KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM',
  'NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY',
]

const TEE_OPTIONS = [
  { value: '', label: '— No Preference —' },
  { value: 'Black', label: '⚫ Black (Championship)' },
  { value: 'Blue', label: '🔵 Blue (Men\'s)' },
  { value: 'White', label: '⚫ White (Senior/Men\'s)' },
  { value: 'Red', label: '🔴 Red (Women\'s/Senior)' },
  { value: 'Gold', label: '🟠 Gold (Senior)' },
  { value: 'Silver', label: '⚪ Silver' },
]

type Player = {
  id: string
  full_name: string
  email: string | null
  ghin: string | null
  home_club: string | null
  manual_hi: number | null
  handicapIndex: number | null
}

type League = { id: string; name: string }
type Course = { id: string; name: string; state: string | null }

export default function PlayersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ghin, setGhin] = useState('')
  const [membership, setMembership] = useState('')
  const [tee, setTee] = useState('')
  const [country, setCountry] = useState('US')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [homeClub, setHomeClub] = useState('')
  const [manualHI, setManualHI] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([])

  const homeClubOptions = state
    ? courses.filter((c) => c.state === state).sort((a, b) => a.name.localeCompare(b.name))
    : []

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchPlayers(), fetchLeagues(), fetchCourses()])
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
        .map((r) => ({ date: r.date, differential: r.differential, nineHoleOnly: r.nine_hole_only }))
      return { ...p, handicapIndex: computeHandicapIndex(playerRounds, p.manual_hi) }
    })

    setPlayers(enriched)
  }

  async function fetchLeagues() {
    const { data } = await supabase.from('leagues').select('id, name').order('name')
    setLeagues(data ?? [])
  }

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('id, name, state')
    setCourses(data ?? [])
  }

  function toggleLeague(id: string) {
    setSelectedLeagues((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    )
  }

  function resetForm() {
    setName(''); setPhone(''); setEmail(''); setGhin(''); setMembership('')
    setTee(''); setCountry('US'); setState(''); setCity(''); setHomeClub('')
    setManualHI(''); setNotes(''); setSelectedLeagues([])
  }

  async function handleSavePlayer(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const playerPayload = {
      full_name: name,
      phone: phone || null,
      email: email || null,
      ghin: ghin || null,
      membership_no: membership || null,
      tee: tee || null,
      country: country || null,
      state: state || null,
      city: city || null,
      home_club: homeClub || null,
      manual_hi: manualHI ? parseFloat(manualHI) : null,
      notes: notes || null,
    }

    let playerId = editingId

    if (editingId) {
      const { error: updateError } = await supabase
        .from('players')
        .update(playerPayload)
        .eq('id', editingId)
      if (updateError) {
        setError(updateError.message)
        return
      }
    } else {
      const { data: playerData, error: insertError } = await supabase
        .from('players')
        .insert(playerPayload)
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      playerId = playerData.id
    }

    if (playerId) {
      await supabase.from('league_members').delete().eq('player_id', playerId)
      if (selectedLeagues.length > 0) {
        const rows = selectedLeagues.map((leagueId) => ({ league_id: leagueId, player_id: playerId }))
        const { error: leagueError } = await supabase.from('league_members').insert(rows)
        if (leagueError) {
          setError(leagueError.message)
          return
        }
      }
    }

    resetForm()
    setEditingId(null)
    setShowAddForm(false)
    await fetchPlayers()
  }

  async function handleEditClick(player: Player) {
    setEditingId(player.id)
    setName(player.full_name)
    setEmail(player.email ?? '')
    setGhin(player.ghin ?? '')
    setHomeClub(player.home_club ?? '')
    setManualHI(player.manual_hi !== null ? String(player.manual_hi) : '')

    const { data } = await supabase
      .from('players')
      .select('phone, membership_no, tee, country, state, city, notes')
      .eq('id', player.id)
      .single()

    if (data) {
      setPhone(data.phone ?? '')
      setMembership(data.membership_no ?? '')
      setTee(data.tee ?? '')
      setCountry(data.country ?? 'US')
      setState(data.state ?? '')
      setCity(data.city ?? '')
      setNotes(data.notes ?? '')
    }

    const { data: memberRows } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('player_id', player.id)
    setSelectedLeagues((memberRows ?? []).map((m) => m.league_id))

    setShowAddForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this player and all their rounds and outing history?')) return

    await supabase.from('rounds').delete().eq('player_id', id)
    await supabase.from('outing_players').delete().eq('player_id', id)
    await supabase.from('outing_hole_scores').delete().eq('player_id', id)
    await supabase.from('outing_front_back').delete().eq('player_id', id)
    await supabase.from('league_members').delete().eq('player_id', id)

    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) setError(error.message)
    else await fetchPlayers()
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Player Roster</h1>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); resetForm() }}
          style={{ padding: '8px 16px' }}
        >
          {showAddForm ? 'Cancel' : '+ Add Player'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleSavePlayer} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>{editingId ? 'Edit Player' : 'Add Player'}</h2>

          <div style={{ marginBottom: '12px' }}>
            <label>Full Name *</label><br />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="First Last" style={{ width: '100%', padding: '8px' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Phone</label><br />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Email</label><br />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>GHIN Number</label><br />
              <input type="text" value={ghin} onChange={(e) => setGhin(e.target.value)} placeholder="e.g. 1234567" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Membership #</label><br />
              <input type="text" value={membership} onChange={(e) => setMembership(e.target.value)} placeholder="Club membership #" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Default Tee</label><br />
            <select value={tee} onChange={(e) => setTee(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              {TEE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Country</label><br />
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="US">United States</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>State</label><br />
              <select
                value={state}
                onChange={(e) => { setState(e.target.value); setHomeClub('') }}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">— Select State —</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>City</label><br />
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Home Club</label><br />
            <select
              value={homeClub}
              onChange={(e) => setHomeClub(e.target.value)}
              disabled={!state}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">{state ? '— Select Home Club —' : '— Select a State first —'}</option>
              {homeClubOptions.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Starter H.I. <small style={{ color: '#888' }}>(provisional)</small></label><br />
            <input
              type="number"
              step="0.1"
              min={0}
              max={54}
              value={manualHI}
              onChange={(e) => setManualHI(e.target.value)}
              placeholder="e.g. 18.4"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Notes</label><br />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '8px' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label><strong>League Membership</strong></label>
            <div style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '10px', marginTop: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {leagues.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>No leagues created yet.</p>
              ) : (
                leagues.map((l) => (
                  <label key={l.id} style={{ display: 'block', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={selectedLeagues.includes(l.id)}
                      onChange={() => toggleLeague(l.id)}
                      style={{ marginRight: '8px' }}
                    />
                    {l.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <button type="submit" style={{ padding: '8px 16px' }}>
            {editingId ? 'Update Player' : 'Save Player'}
          </button>
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
                <td style={{ padding: '8px' }}>{p.handicapIndex !== null ? p.handicapIndex.toFixed(1) : 'No H.I.'}</td>
                <td style={{ padding: '8px' }}>
                  <button onClick={() => handleEditClick(p)} style={{ padding: '4px 8px', marginRight: '6px' }}>Edit</button>
                  <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 8px' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}