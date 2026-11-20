import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { company, signOut } = useAuth()
  return (
    <>
      <header className="topbar">
        <strong>{company?.name}</strong>
        <nav>
          <NavLink to="/" end>Início</NavLink>
          <NavLink to="/compras">Compras</NavLink>
          <NavLink to="/vendas">Vendas</NavLink>
          <NavLink to="/fornecedores">Fornecedores</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/materiais">Materiais</NavLink>
          {company?.role !== 'operator' && <NavLink to="/gastos">Gastos</NavLink>}
          {company?.role !== 'operator' && <NavLink to="/relatorios">Relatórios</NavLink>}
          {company?.role !== 'operator' && <NavLink to="/retiradas">Retiradas</NavLink>}
          {company?.role !== 'operator' && <NavLink to="/equipe">Equipe</NavLink>}
        </nav>
        <button onClick={signOut}>Sair</button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}