import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
    brl, dayStartISO, monthStartInput, nextDayStartISO, toInputDate, todayInput,
} from '../lib/format'

type Report = {
    purchases: { count: number; total: number; paid: number }
    sales: { count: number; total: number; received: number }
    profit: { revenue_with_cost: number; cost: number; revenue_without_cost: number }
    write_offs_cost: number
    expenses_total: number
    expenses_by_category: { name: string; total: number }[]
    cash: { received: number; paid_purchases: number; paid_expenses: number }
    materials: {
        name: string
        unit: 'kg' | 'un'
        bought_qty: number
        bought_value: number
        sold_qty: number
        sold_value: number
        sold_value_costed: number
        sold_cost: number
        stock: number
    }[]
}

const qty = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const br = (s: string) => s.split('-').reverse().join('/')

export default function Reports() {
    const { company } = useAuth()
    const companyId = company!.id
    const [from, setFrom] = useState(monthStartInput())
    const [to, setTo] = useState(todayInput())
    const [copied, setCopied] = useState(false)

    const { data: r, isLoading, error } = useQuery({
        queryKey: ['report', companyId, from, to],
        enabled: !!from && !!to,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('report_summary', {
                p_company_id: companyId,
                p_from: dayStartISO(from),
                p_to: nextDayStartISO(to),
            })
            if (error) throw error
            return data as Report
        },
    })

    function preset(kind: 'today' | 'week' | 'month' | 'lastMonth') {
        const now = new Date()
        if (kind === 'today') {
            setFrom(todayInput()); setTo(todayInput())
        } else if (kind === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 6)
            setFrom(toInputDate(d)); setTo(todayInput())
        } else if (kind === 'month') {
            setFrom(monthStartInput()); setTo(todayInput())
        } else {
            setFrom(toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
            setTo(toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)))
        }
    }

    function buildText(x: Report) {
        const saldo = x.cash.received - x.cash.paid_purchases - x.cash.paid_expenses
        const lines = [
            `📊 *Relatório — ${company!.name}*`,
            `Período: ${br(from)} a ${br(to)}`,
            '',
            `*Compras:* ${x.purchases.count} — ${brl(x.purchases.total)}`,
            `*Vendas:* ${x.sales.count} — ${brl(x.sales.total)}`,
            `*Gastos:* ${brl(x.expenses_total)}`,
            '',
            '*Caixa do período*',
            `Recebido em vendas: ${brl(x.cash.received)}`,
            `Pago em compras: ${brl(x.cash.paid_purchases)}`,
            `Gastos pagos: ${brl(x.cash.paid_expenses)}`,
            `Saldo de caixa: ${brl(saldo)}`,
            `Lucro bruto estimado: ${brl(x.profit.revenue_with_cost - x.profit.cost)}`,
            `Baixas de estoque (custo): ${brl(x.write_offs_cost)}`,
        ]
        if (x.materials.length > 0) {
            lines.push('', '*Materiais*')
            for (const m of x.materials) {
                lines.push(
                    `• ${m.name}: comprou ${qty(m.bought_qty)} ${m.unit} (${brl(m.bought_value)}) | ` +
                    `vendeu ${qty(m.sold_qty)} ${m.unit} (${brl(m.sold_value)}) | estoque ${qty(m.stock)} ${m.unit}`,
                )
            }
        }
        if (x.expenses_by_category.length > 0) {
            lines.push('', '*Gastos por categoria*')
            for (const c of x.expenses_by_category) lines.push(`• ${c.name}: ${brl(c.total)}`)
        }
        return lines.join('\n')
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            window.prompt('Copie o texto abaixo:', text)
        }
    }

    const saldo = r ? r.cash.received - r.cash.paid_purchases - r.cash.paid_expenses : 0
    const profit = r ? r.profit.revenue_with_cost - r.profit.cost : 0
    const text = r ? buildText(r) : ''

    return (
        <>
            <div className="panel">
                <h2>Relatórios</h2>
                <div className="filters">
                    <label>De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label>Até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
                </div>
                <div className="actions" style={{ flexWrap: 'wrap' }}>
                    <button className="btn secondary small" onClick={() => preset('today')}>Hoje</button>
                    <button className="btn secondary small" onClick={() => preset('week')}>Últimos 7 dias</button>
                    <button className="btn secondary small" onClick={() => preset('month')}>Este mês</button>
                    <button className="btn secondary small" onClick={() => preset('lastMonth')}>Mês passado</button>
                </div>
            </div>

            {isLoading && <p>Carregando...</p>}
            {error && <p className="msg">{(error as { message?: string }).message ?? 'Erro ao gerar o relatório'}</p>}

            {r && (
                <>
                    <div className="stats">
                        <div className="stat"><span>Compras ({r.purchases.count})</span><strong>{brl(r.purchases.total)}</strong></div>
                        <div className="stat"><span>Vendas ({r.sales.count})</span><strong>{brl(r.sales.total)}</strong></div>
                        <div className="stat"><span>Gastos</span><strong>{brl(r.expenses_total)}</strong></div>
                        <div className="stat"><span>Saldo de caixa</span><strong>{brl(saldo)}</strong></div>
                        <div className="stat"><span>Lucro bruto estimado</span><strong>{brl(profit)}</strong></div>
                    </div>

                    <div className="panel">
                        <h3>Caixa do período</h3>
                        <p>Recebido em vendas: <strong>{brl(r.cash.received)}</strong></p>
                        <p>Pago em compras: <strong>{brl(r.cash.paid_purchases)}</strong></p>
                        <p>Gastos pagos: <strong>{brl(r.cash.paid_expenses)}</strong></p>
                        <p style={{ fontSize: 13, color: '#666' }}>
                            Saldo de caixa não é lucro: material comprado que ainda está no estoque
                            já saiu do caixa, mas ainda não virou venda.
                        </p>
                    </div>

                    <div className="panel">
                        <div className="panel">
                            <h3>Lucro bruto estimado</h3>
                            <p>Vendas com custo conhecido: <strong>{brl(r.profit.revenue_with_cost)}</strong></p>
                            <p>Custo desses materiais: <strong>{brl(r.profit.cost)}</strong></p>
                            <p>
                                Lucro bruto: <strong>{brl(profit)}</strong>
                                {r.profit.revenue_with_cost > 0 &&
                                    ` (margem de ${((profit / r.profit.revenue_with_cost) * 100).toFixed(1).replace('.', ',')}%)`}
                            </p>
                            <p>Baixas de estoque (perdas, uso próprio, ajustes): <strong>{brl(r.write_offs_cost)}</strong></p>
                            {r.profit.revenue_without_cost > 0 && (
                                <p className="msg">
                                    {brl(r.profit.revenue_without_cost)} em vendas ficaram fora do cálculo porque o material
                                    não tinha compra registrada.
                                </p>
                            )}
                            <p style={{ fontSize: 13, color: '#666' }}>
                                Custo = preço médio de compra do material até a data da venda. É uma estimativa,
                                não substitui a contabilidade.
                            </p>
                        </div>
                        <h3>Por material</h3>
                        {r.materials.length === 0 ? <p>Sem movimento de materiais.</p> : (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Material</th><th>Comprado</th><th>Vendido</th><th>Estoque hoje</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {r.materials.map((m) => (
                                            <tr key={m.name}>
                                                <td>{m.name}</td>
                                                <td>{qty(m.bought_qty)} {m.unit}<br /><small>{brl(m.bought_value)}</small></td>
                                                <td>
                                                    {qty(m.sold_qty)} {m.unit}<br /><small>{brl(m.sold_value)}</small>
                                                    {m.sold_value_costed > 0 && (
                                                        <><br /><small>lucro {brl(m.sold_value_costed - m.sold_cost)}</small></>
                                                    )}
                                                </td>                                                <td>{qty(m.stock)} {m.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="panel">
                        <h3>Gastos por categoria</h3>
                        {r.expenses_by_category.length === 0 ? <p>Nenhum gasto no período.</p> : (
                            <div className="table-wrap">
                                <table>
                                    <tbody>
                                        {r.expenses_by_category.map((c) => (
                                            <tr key={c.name}><td>{c.name}</td><td>{brl(c.total)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="panel">
                        <h3>Enviar relatório</h3>
                        <div className="actions" style={{ flexWrap: 'wrap' }}>
                            <a className="btn" target="_blank" rel="noreferrer"
                                href={`https://wa.me/?text=${encodeURIComponent(text)}`}>
                                Compartilhar no WhatsApp
                            </a>
                            <button className="btn secondary" onClick={() => copy(text)}>
                                {copied ? 'Copiado!' : 'Copiar texto'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}