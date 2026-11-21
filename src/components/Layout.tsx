import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { NAV, TABS, visibleNav } from '../lib/nav'

export default function Layout() {
  const { company, session, signOut } = useAuth()
  const { pathname } = useLocation()

  const items = visibleNav(company!.role)
  const groups = [...new Set(items.map((i) => i.group))]
  const tabs = TABS.map((t) => NAV.find((i) => i.to === t)!)
  const inTabs = TABS.some((t) => (t === '/' ? pathname === '/' : pathname.startsWith(t)))

  function logout() {
    if (window.confirm('Sair da conta?')) signOut()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="logo">G</span>
          <span className="company">{company!.name}</span>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="group">{g}</div>
            {items.filter((i) => i.group === g).map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}>
                <span>{i.icon}</span>{i.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="spacer" />
        <div className="user">{session?.user.email}</div>
        <button className="logout" onClick={logout}>Sair</button>
      </aside>

      <div className="main">
        <header className="mobile-top">
          <span className="logo">G</span>
          <strong>{company!.name}</strong>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{t.icon}</span>
            {t.shortLabel ?? t.label}
          </NavLink>
        ))}
        <NavLink to="/mais" className={inTabs ? '' : 'active'}>
          <span className="ico">☰</span>
          Mais
        </NavLink>
      </nav>
    </div>
  )
}