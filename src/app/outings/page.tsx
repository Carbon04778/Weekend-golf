'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type League = { id: string; name: string }
type Player = { id: string; full_name: string }
type Tee = { name: string; rating: number | null; slope: number | null; par: number | null }
type Course = { id: string; name: string; tees: Tee[] }
type Outing = {
  id: string
  date: string
  time: string | null
  status: string
  holes_to_play: string
  notes: string | null
  league_id: string | null
  course_id: string | null
}

export default function OutingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [outings, setOutings] = useState<Outing[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [date, setDate] = useState('')
  const [time, setTime] = useState('08:00')
  const [leagueId, setLeagueId] = useState('')
  const [status, setStatus] = useState('upcoming')
  const [holesToPlay, setHolesToPlay] = useState('18')
  const [courseId, setCourseId] = useState('')
  const [teeName, setTeeName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])

  const selectedCourse = courses.find((c) => c.id === courseId)
  const selectedTee = selectedCourse?.tees.find((t) => t.name === teeName)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await Promise.all([fetchOutings(), fetchLeagues(), fetchPlayers(), fetchCourses()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchOutings() {
    const { data, error } = await supabase
      .from('outings')
      .select('id, date, time, status, holes_to_play, notes, league_id, course_id')
      .order('date', { ascending: false })
    if (error) setError(error.message)
    else setOutings(data ?? [])
  }

  async function fetchLeagues() {
    const { data } = await supabase.from('leagues').select('id, name').order('name')
    setLeagues(data ?? [])
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('id, full_name').order('full_name')
    setPlayers(data ?? [])
  }

  async function fetchCourses() {
    const { data: courseRows } = await supabase.from('courses').select('id, name').order('name')
    const { data: teeRows } = await supabase.from('course_tees').select('course_id, name, rating, slope, par')

    const merged: Course[] = (courseRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      tees: (teeRows ?? []).filter((t) => t.course_id === c.id),
    }))
    setCourses(merged)
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function getLeagueName(id: string | null) {
    return leagues.find((l) => l.id === id)?.name ?? '-'
  }

  function getCourseName(id: string | null) {
    return courses.find((c) => c.id === id)?.name ?? '-'
  }

  async function handleAddOuting(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { data: { session } } = await supabase.auth.getSession()

    const { data: outingData, error: outingError } = await supabase
      .from('outings')
      .insert({
        date,
        time: time || null,
        league_id: leagueId || null,
        status,
        holes_to_play: holesToPlay,
        course_id: courseId || null,
        tee: teeName || null,
        course_rating: selectedTee?.rating ?? null,
        slope_rating: selectedTee?.slope ?? null,
        par: selectedTee?.par ?? null,
        notes: notes || null,
        created_by: session?.user.id ?? null,
      })
      .select()
      .single()

    if (outingError) {
      setError(outingError.message)
      return
    }

    if (selectedPlayers.length > 0) {
      const rows = selectedPlayers.map((playerId) => ({
        outing_id: outingData.id,
        player_id: playerId,
      }))
      const { error: playerError } = await supabase.from('outing_players').insert(rows)
      if (playerError) {
        setError(playerError.message)
        return
      }
    }

    setDate('')
    setTime('08:00')
    setLeagueId('')
    setStatus('upcoming')
    setHolesToPlay('18')
    setCourseId('')
    setTeeName('')
    setNotes('')
    setSelectedPlayers([])
    setShowAddForm(false)
    await fetchOutings()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this outing?')) return
    const { error } = await supabase.from('outings').delete().eq('id', id)
    if (error) setError(error.message)
    else await fetchOutings()
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Outings</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '8px 16px' }}>
          {showAddForm ? 'Cancel' : '+ Schedule Outing'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddOuting} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Date *</label><br />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Tee Time</label><br />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>League</label><br />
              <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="">— No League —</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Status</label><br />
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="upcoming">Upcoming</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Holes to Play</label><br />
              <select value={holesToPlay} onChange={(e) => setHolesToPlay(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="18">18 Holes</option>
                <option value="front9">Front 9</option>
                <option value="back9">Back 9</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Golf Course *</label><br />
              <select
                value={courseId}
                onChange={(e) => { setCourseId(e.target.value); setTeeName('') }}
                required
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">— Select Course —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Tee</label><br />
              <select value={teeName} onChange={(e) => setTeeName(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="">— Select Tee —</option>
                {selectedCourse?.tees.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}{t.rating ? ` (${t.rating}/${t.slope})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Par</label><br />
              <input type="text" value={selectedTee?.par ?? ''} readOnly style={{ width: '100%', padding: '8px', background: '#f0f0f0' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Course Rating</label><br />
              <input type="text" value={selectedTee?.rating ?? ''} readOnly style={{ width: '100%', padding: '8px', background: '#f0f0f0' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Slope</label><br />
              <input type="text" value={selectedTee?.slope ?? ''} readOnly style={{ width: '100%', padding: '8px', background: '#f0f0f0' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Notes</label><br />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '8px' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label><strong>Players in this Outing</strong></label>
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

          <button type="submit" style={{ padding: '8px 16px' }}>Save Outing</button>
        </form>
      )}

      {outings.length === 0 ? (
        <p>No outings yet. Click &quot;Schedule Outing&quot; to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Course</th>
              <th style={{ padding: '8px' }}>League</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Holes</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {outings.map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{o.date} {o.time ?? ''}</td>
                <td style={{ padding: '8px' }}>{getCourseName(o.course_id)}</td>
                <td style={{ padding: '8px' }}>{getLeagueName(o.league_id)}</td>
                <td style={{ padding: '8px' }}>{o.status}</td>
                <td style={{ padding: '8px' }}>{o.holes_to_play}</td>
                <td style={{ padding: '8px' }}>
                  <button onClick={() => handleDelete(o.id)} style={{ padding: '4px 8px' }}>
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