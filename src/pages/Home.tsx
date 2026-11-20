import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dateTime, monthStartISO } from '../lib/format'

type Stock = { material_id: string; name: string; unit: 'kg' | 'un'; balance: number }
type Recent = {
  id: string
  purchased_at: string
  status: 'confirmed' | 'cancelled'
  total_amount: number
  suppliers: { name: string } | null
}
type Cash = { direction: 'in' | 'out'; category: string; amount: number }

export default function Home() {
  const { company } = useAuth()
  const companyId = company!.id
  const isAdmin = company!.role !== 'operator'

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', companyId],
    queryFn: async () => {
      const start = monthStartISO()
      const [stock, pMonth, sMonth, toPay, toReceive, cash, recent] = await Promise.all([
        supabase.from('v_stock_balance').select('material_id, name, unit, balance').order('name'),
        supabase.from('purchases').select('total_amount')
          .eq('status', 'confirmed').gte('purchased_at', start),
        supabase.from('sales').select('total_amount')
          .eq('status', 'confirmed').gte('sold_at', start),
        supabase.from('v_supplier_totals').select('pending_amount'),
        supabase.from('v_customer_totals').select('pending_amount'),
        supabase.from('financial_transactions').select('direction, category, amount').gte('occurred_at', start),
        supabase.from('purchases')
          .select('id, purchased_at, status, total_amount, suppliers(name)')
          .order('purchased_at', { ascending: false }).limit(5),
      ])
      for (const r of [stock, pMonth, sMonth, toPay, toReceive, cash, recent]) {
        if (r.error) throw r.error
      }

      const sum = (rows: unknown[] | null, key: string) =>
        (rows ?? []).reduce<number>((s, r) => s + Number((r as Record<string, unknown>)[key]), 0)

      const cashRows = (cash.data ?? []) as Cash[]
      // compras: saída conta (+), estorno conta (−). vendas: entrada conta (+), estorno conta (−).
      const paidInPurchases = cashRows
        .filter((r) => r.category.startsWith('purchase'))
        .reduce((s, r) => s + (r.direction === 'out' ? Number(r.amount) : -Number(r.amount)), 0)
      const receivedInSales = cashRows
        .filter((r) => r.category.startsWith('sale'))
        .reduce((s, r) => s + (r.direction === 'in' ? Number(r.amount) : -Number(r.amount)), 0)

      return {
        stock: (stock.data ?? []) as Stock[],
        purchasesCount: (pMonth.data ?? []).length,
        purchasesTotal: sum(pMonth.data, 'total_amount'),
        salesCount: (sMonth.data ?? []).length,
        salesTotal: sum(sMonth.data, 'total_amount'),
        toPay: sum(toPay.data, 'pending_amount'),
        toReceive: sum(toReceive.data, 'pending_amount'),
        paidInPurchases,
        receivedInSales,
        recent: (recent.data ?? []) as unknown as Recent[],
      }
    },
  })

  if (isLoading || !data) return <p>Carregando...</p>

  return (
    <>
      <div className="stats">
        <div className="stat"><span>Compras no mês ({data.purchasesCount})</span><strong>{brl(data.purchasesTotal)}</strong></div>
        <div className="stat"><span>Vendas no mês ({data.salesCount})</span><strong>{brl(data.salesTotal)}</strong></div>
        <div className="stat"><span>A pagar (fornecedores)</span><strong>{brl(data.toPay)}</strong></div>
        <div className="stat"><span>A receber (clientes)</span><strong>{brl(data.toReceive)}</strong></div>
        {isAdmin && (
          <>
            <div className="stat"><span>Pago em compras (mês)</span><strong>{brl(data.paidInPurchases)}</strong></div>
            <div className="stat"><span>Recebido em vendas (mês)</span><strong>{brl(data.receivedInSales)}</strong></div>
            <div className="stat">
              <span>Saldo de caixa no mês</span>
              <strong>{brl(data.receivedInSales - data.paidInPurchases)}</strong>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <div className="row-between">
          <h3>Últimas compras</h3>
          <div className="actions">
            <Link to="/compras/nova" className="btn secondary small">+ Compra</Link>
            <Link to="/vendas/nova" className="btn small">+ Venda</Link>
          </div>
        </div>
        {data.recent.length === 0 ? <p>Nenhuma compra ainda.</p> : (
          <div className="table-wrap">
            <table>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/compras/${r.id}`}>{dateTime(r.purchased_at)}</Link></td>
                    <td>{r.suppliers?.name ?? 'Avulsa'}</td>
                    <td>{brl(r.total_amount)}</td>
                    <td>{r.status === 'cancelled' && <span className="badge cancelled">Cancelada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Estoque atual</h3>
        {data.stock.length === 0 ? <p>Nenhum material cadastrado.</p> : (
          <div className="table-wrap">
            <table>
              <tbody>
                {data.stock.map((m) => (
                  <tr key={m.material_id}>
                    <td>{m.name}</td>
                    <td>
                      {Number(m.balance).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {m.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}