export type NavItem = {
    to: string
    label: string
    shortLabel?: string
    icon: string
    group: string
    desc?: string
    adminOnly?: boolean
}

export const NAV: NavItem[] = [
    { to: '/', label: 'Início', icon: '🏠', group: 'Operação' },
    { to: '/compras', label: 'Compras', icon: '📥', group: 'Operação', desc: 'Material que entra' },
    { to: '/vendas', label: 'Vendas', icon: '📤', group: 'Operação', desc: 'Material que sai' },
    { to: '/materiais', label: 'Materiais e estoque', shortLabel: 'Estoque', icon: '📦', group: 'Estoque', desc: 'Cadastro e saldo' },
    { to: '/retiradas', label: 'Retiradas', icon: '🧾', group: 'Estoque', desc: 'Perdas e ajustes', adminOnly: true },
    { to: '/fornecedores', label: 'Fornecedores', icon: '🚚', group: 'Cadastros', desc: 'Quem vende para você' },
    { to: '/clientes', label: 'Clientes', icon: '🤝', group: 'Cadastros', desc: 'Quem compra de você' },
    { to: '/gastos', label: 'Gastos', icon: '💸', group: 'Financeiro', desc: 'Luz, frete, salários...', adminOnly: true },
    { to: '/relatorios', label: 'Relatórios', icon: '📊', group: 'Financeiro', desc: 'Por período, com WhatsApp', adminOnly: true },
    { to: '/equipe', label: 'Equipe', icon: '👥', group: 'Administração', desc: 'Convites e permissões', adminOnly: true },
]

// atalhos fixos da barra de baixo no celular
export const TABS = ['/', '/compras', '/vendas', '/materiais']

export const visibleNav = (role: string) =>
    NAV.filter((i) => !i.adminOnly || role !== 'operator')
export const ROLE_LABEL: Record<string, string> = {
    owner: 'Dono',
    admin: 'Administrador',
    operator: 'Operador',
}