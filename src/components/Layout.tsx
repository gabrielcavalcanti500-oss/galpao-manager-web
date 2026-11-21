import { Menu, LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { NAV, ROLE_LABEL, TABS, visibleNav } from '../lib/nav'
import { displayName, useMyProfile } from '../lib/profile'

export default function Layout() {
  const { company, session, signOut } = useAuth()
  const { data: profile } = useMyProfile()
  const { pathname } = useLocation()

  const name = displayName(profile?.full_name, session?.user.email)
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
          <img className="logo" src="/icons/icon-192.png" alt="" />
          <span className="product">Galpão<br />Manager</span>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="group">{g}</div>
            {items.filter((i) => i.group === g).map((i) => {
              const Icon = i.icon
              return (
                <NavLink key={i.to} to={i.to} end={i.to === '/'}
                  className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={20} />
                  {i.label}
                </NavLink>
              )
            })}
          </div>
        ))}
        <div className="spacer" />
        <div className="company-box">
          <small>Minha empresa</small>
          {company!.name}
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={18} /> Sair
        </button>
      </aside>

      <div className="main">
        <header className="mobile-top">
          <img className="logo" src="/icons/icon-192.png" alt="" />
          <div>
            <strong>Galpão Manager</strong>
            <small>{company!.name}</small>
          </div>
        </header>

        <div className="desk-top">
          <div className="user-chip">
            <span className="avatar">{name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>{ROLE_LABEL[company!.role]}</small>
            </div>
          </div>
        </div>

        <main className="page">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={22} />
              {t.shortLabel ?? t.label}
            </NavLink>
          )
        })}
        <NavLink to="/mais" className={inTabs ? '' : 'active'}>
          <Menu size={22} />
          Mais
        </NavLink>
      </nav>
    </div>
  )
}