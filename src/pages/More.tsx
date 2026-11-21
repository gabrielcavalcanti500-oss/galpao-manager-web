import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { TABS, visibleNav } from '../lib/nav'

export default function More() {
    const { company, session, signOut } = useAuth()
    const items = visibleNav(company!.role).filter((i) => !TABS.includes(i.to))
    const groups = [...new Set(items.map((i) => i.group))]

    function logout() {
        if (window.confirm('Sair da conta?')) signOut()
    }

    return (
        <>
            <h2>Mais</h2>
            {groups.map((g) => (
                <div key={g}>
                    <div className="menu-group">{g}</div>
                    {items.filter((i) => i.group === g).map((i) => (
                        <Link key={i.to} to={i.to} className="menu-item">
                            <span className="ico">{i.icon}</span>
                            <span>
                                {i.label}
                                {i.desc && <small>{i.desc}</small>}
                            </span>
                        </Link>
                    ))}
                </div>
            ))}

            <div className="logout-zone">
                <p><small>Conectado como {session?.user.email}</small></p>
                <button className="btn danger" onClick={logout}>Sair da conta</button>
            </div>
        </>
    )
}