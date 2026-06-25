'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Tee = {
  name: string
  rating: string
  slope: string
  par: string
}

type Course = {
  id: string
  name: string
  country: string | null
  state: string | null
  city: string | null
  notes: string | null
}

export default function CoursesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [name, setName] = useState('')
  const [country, setCountry] = useState('US')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const [tees, setTees] = useState<Tee[]>([{ name: 'Blue', rating: '', slope: '', par: '72' }])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchCourses()
      setLoading(false)
    }
    load()
  }, [router])

  async function fetchCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, country, state, city, notes')
      .order('name')

    if (error) {
      setError(error.message)
    } else {
      setCourses(data ?? [])
    }
  }

  function addTeeRow() {
    setTees([...tees, { name: '', rating: '', slope: '', par: '' }])
  }

  function updateTee(index: number, field: keyof Tee, value: string) {
    const updated = [...tees]
    updated[index][field] = value
    setTees(updated)
  }

  function removeTee(index: number) {
    setTees(tees.filter((_, i) => i !== index))
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .insert({ name, country, state: state || null, city: city || null, notes: notes || null })
      .select()
      .single()

    if (courseError) {
      setError(courseError.message)
      return
    }

    const teeRows = tees
      .filter((t) => t.name)
      .map((t) => ({
        course_id: courseData.id,
        name: t.name,
        rating: t.rating ? parseFloat(t.rating) : null,
        slope: t.slope ? parseInt(t.slope) : null,
        par: t.par ? parseInt(t.par) : null,
      }))

    if (teeRows.length > 0) {
      const { error: teeError } = await supabase.from('course_tees').insert(teeRows)
      if (teeError) {
        setError(teeError.message)
        return
      }
    }

    setName('')
    setCountry('US')
    setState('')
    setCity('')
    setNotes('')
    setTees([{ name: 'Blue', rating: '', slope: '', par: '72' }])
    setShowAddForm(false)
    await fetchCourses()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this course?')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      await fetchCourses()
    }
  }

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Golf Courses</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '8px 16px' }}>
          {showAddForm ? 'Cancel' : '+ Add Course'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showAddForm && (
        <form onSubmit={handleAddCourse} style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '12px' }}>
            <label>Course Name *</label><br />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Pebble Beach Golf Links"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label>Country</label><br />
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>State</label><br />
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>City</label><br />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label>Notes</label><br />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label><strong>Tee Options</strong></label>
              <button type="button" onClick={addTeeRow} style={{ padding: '4px 8px' }}>+ Add Tee</button>
            </div>
            {tees.map((tee, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Tee (e.g. Blue)"
                  value={tee.name}
                  onChange={(e) => updateTee(i, 'name', e.target.value)}
                  style={{ flex: 1.2, padding: '6px' }}
                />
                <input
                  type="text"
                  placeholder="Rating"
                  value={tee.rating}
                  onChange={(e) => updateTee(i, 'rating', e.target.value)}
                  style={{ flex: 1, padding: '6px' }}
                />
                <input
                  type="text"
                  placeholder="Slope"
                  value={tee.slope}
                  onChange={(e) => updateTee(i, 'slope', e.target.value)}
                  style={{ flex: 1, padding: '6px' }}
                />
                <input
                  type="text"
                  placeholder="Par"
                  value={tee.par}
                  onChange={(e) => updateTee(i, 'par', e.target.value)}
                  style={{ flex: 1, padding: '6px' }}
                />
                <button type="button" onClick={() => removeTee(i)} style={{ padding: '6px 10px' }}>×</button>
              </div>
            ))}
          </div>

          <button type="submit" style={{ padding: '8px 16px', marginTop: '16px' }}>Save Course</button>
        </form>
      )}

      {courses.length === 0 ? (
        <p>No courses yet. Click &quot;Add Course&quot; to get started.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Location</th>
              <th style={{ padding: '8px' }}>Notes</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}>{c.name}</td>
                <td style={{ padding: '8px' }}>{[c.city, c.state, c.country].filter(Boolean).join(', ') || '-'}</td>
                <td style={{ padding: '8px' }}>{c.notes ?? '-'}</td>
                <td style={{ padding: '8px' }}>
                  <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px' }}>
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
