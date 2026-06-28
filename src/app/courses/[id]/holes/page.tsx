'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type HoleConfig = { hole: number; par: string; si: string }

export default function CourseHolesPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [loading, setLoading] = useState(true)
  const [courseName, setCourseName] = useState('')
  const [holes, setHoles] = useState<HoleConfig[]>(
    Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: '', si: '' }))
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: course } = await supabase
        .from('courses')
        .select('name')
        .eq('id', courseId)
        .single()
      setCourseName(course?.name ?? 'Unknown Course')

      const { data: existingHoles } = await supabase
        .from('course_holes')
        .select('hole, par, si')
        .eq('course_id', courseId)
        .order('hole')

      if (existingHoles && existingHoles.length > 0) {
        const filled = Array.from({ length: 18 }, (_, i) => {
          const found = existingHoles.find((h) => h.hole === i + 1)
          return {
            hole: i + 1,
            par: found ? String(found.par) : '',
            si: found ? String(found.si) : '',
          }
        })
        setHoles(filled)
      }

      setLoading(false)
    }
    load()
  }, [courseId, router])

  function updateHole(index: number, field: 'par' | 'si', value: string) {
    const updated = [...holes]
    updated[index][field] = value
    setHoles(updated)
  }

  // Validation: stroke index 1-18, each used exactly once, matching official scorecard rules
  function getStrokeIndexWarning(): string {
    const filledSI = holes.map((h) => h.si).filter((v) => v !== '')
    if (filledSI.length < 18) return ''
    const numbers = filledSI.map(Number)
    const unique = new Set(numbers)
    if (unique.size !== 18) return '⚠ Each stroke index (1-18) should be used exactly once.'
    if (Math.min(...numbers) !== 1 || Math.max(...numbers) !== 18) {
      return '⚠ Stroke index values should range from 1 to 18.'
    }
    return ''
  }

  async function handleSave() {
    setError('')
    setMessage('')

    const incomplete = holes.some((h) => h.par === '' || h.si === '')
    if (incomplete) {
      setError('Please fill in par and stroke index for all 18 holes.')
      return
    }

    // Replace any existing config for this course (simplest correct approach:
    // delete then insert fresh, since this is a small, infrequent admin task)
    const { error: deleteError } = await supabase
      .from('course_holes')
      .delete()
      .eq('course_id', courseId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    const rows = holes.map((h) => ({
      course_id: courseId,
      hole: h.hole,
      par: parseInt(h.par),
      si: parseInt(h.si),
    }))

    const { error: insertError } = await supabase.from('course_holes').insert(rows)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setMessage('Hole configuration saved!')
  }

  const totalPar = holes.reduce((sum, h) => sum + (parseInt(h.par) || 0), 0)
  const siWarning = getStrokeIndexWarning()

  if (loading) {
    return <main style={{ padding: '40px' }}>Loading...</main>
  }

  return (
    <main style={{ padding: '40px', maxWidth: '700px' }}>
      <h1>⛳ Hole Configuration — {courseName}</h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Set the par and stroke index (handicap difficulty rank, 1 = hardest) for each hole.
        This is the source of truth used for scoring and net calculations.
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {siWarning && <p style={{ color: '#b8860b' }}>{siWarning}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '6px' }}>Hole</th>
            <th style={{ padding: '6px' }}>Par</th>
            <th style={{ padding: '6px' }}>Stroke Index</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((h, i) => (
            <tr key={h.hole} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>{h.hole}</td>
              <td style={{ padding: '6px' }}>
                <input
                  type="number"
                  min={3}
                  max={6}
                  value={h.par}
                  onChange={(e) => updateHole(i, 'par', e.target.value)}
                  style={{ width: '60px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '6px' }}>
                <input
                  type="number"
                  min={1}
                  max={18}
                  value={h.si}
                  onChange={(e) => updateHole(i, 'si', e.target.value)}
                  style={{ width: '60px', padding: '4px' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '12px', fontWeight: 600 }}>Total Par: {totalPar}</p>

      <button onClick={handleSave} style={{ padding: '8px 16px', marginTop: '12px' }}>
        Save Hole Configuration
      </button>
    </main>
  )
}