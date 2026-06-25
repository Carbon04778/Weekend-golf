'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Account = {
  id: string
  role: string
  player_id: string | null
  email?: string
}

type Player = { id: string; full_name: string }

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('player')
  const [playerId, setPlayerId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'admin') {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setIsAdmin(true)
      await Promise.all([fetchAccounts(), fetchPlayers()])
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchAccounts() {
    const { data } = await supabase.from('profiles').select('id, role, player_id')
    setAccounts(data ?? [])
  }

  async function fetchPlayers() {
    const { data } = await supabase.from('players').select('id, full_name').order('full_name')
    setPlayers(data ?? [])
  }

  function getPlayerName(id: string | null) {
    return players.find((p) => p.id === id)?.full_name ?? '—'
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired, please log in again.')
      return
    }

    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, password, role, playerId: playerId || null }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error ?? 'Something went wrong.')
      return
    }

    setMessage(`Account created for ${email}`)
    setEmail('')
    setPassword('')
    setRole('player')
    setPlayerId('')
    await fetchAccounts()
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  if (!isAdmin) {
    return (
      <main style={{ padding: '40px' }}>
        <h1>⚙ Admin</h1>
        <p style={{ color: 'red' }}>You don&apos;t have permission to view this page.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '40px' }}>
      <h1>⚙ Admin — User Accounts</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <form onSubmit={handleCreateUser} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc', maxWidth: '500px' }}>
        <h2>➕ Create Account</h2>

        <div style={{ marginBottom: '12px' }}>
          <label>Email *</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="player@email.com"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Password *</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Min 6 characters"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Role *</label><br />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="player">Player (View Only)</option>
            <option value="league_owner">League Owner</option>
            <option value="admin">Admin (Full Access)</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Link to Player Profile</label><br />
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="">— Optional —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        <button type="submit" style={{ padding: '8px 16px' }}>➕ Create Account</button>
      </form>

      <h2>👤 Accounts</h2>
      {accounts.length === 0 ? (
        <p>No accounts yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Role</th>
              <th style={{ padding: '8px' }}>Linked Player</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{a.role}</td>
                <td style={{ padding: '8px' }}>{getPlayerName(a.player_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}