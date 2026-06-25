'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import styles from './NavBar.module.css'

const NAV_ITEMS = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/players', icon: '👥', label: 'Players' },
  { href: '/score', icon: '✏', label: 'Score' },
  { href: '/history', icon: '📋', label: 'History' },
  { href: '/leagues', icon: '🏌', label: 'Leagues' },
  { href: '/outings', icon: '📅', label: 'Outings' },
  { href: '/courses', icon: '⛳', label: 'Courses' },
  { href: '/season-stats', icon: '📈', label: 'Season Stats' },
  { href: '/support', icon: '❓', label: 'Support' },
  { href: '/admin', icon: '⚙', label: 'Admin' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState('')
  const [initials, setInitials] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const email = session.user.email ?? ''
      setInitials(email.slice(0, 2).toUpperCase())

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setRole(profile?.role ?? '')
    }
    loadUser()
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login') return null

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logoLink}>
        <Logo size={82} />
        <span className={styles.logoText}>Weekend Hackers</span>
      </Link>

      <div className={`${styles.navLinks} ${menuOpen ? styles.open : ''}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navBtn} ${isActive ? styles.active : ''}`}
            >
              {item.icon} <span className={styles.navLabel}>{item.label}</span>
            </Link>
          )
        })}
        <div className={styles.mobileEmail}>{initials} ({role})</div>
        <button onClick={handleSignOut} className={`${styles.navBtn} ${styles.mobileSignOut}`}>
          <span>🚪</span> Sign Out
        </button>
      </div>

      <div className={styles.navRight}>
        <span className={styles.userBadge} title={`${initials} (${role})`}>
          {initials}
          <span className={styles.userRole}>({role})</span>
        </span>
        <button onClick={handleSignOut} className={styles.signOutBtn}>
          Sign Out
        </button>
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
      </div>
    </nav>
  )
}