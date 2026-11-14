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

export default function Home() {
  const { company } = useAuth()
  const companyId = company!.id
  const isAdmin = company!.role !== 'operator'

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', companyId],
    queryFn: async () => {
      const start = monthStartISO()
      const [stock, month, pending, cash, recent] = await Promise.all([
        supabase.from('v_stock_balance').select('material_id, name, unit, balance').order('name'),
        supabase.from('purchases').select('total_amount, paid_amount')
          .eq('status', 'confirmed').gte('purchased_at', start),
        supabase.from('v_supplier_totals').select('pending_amount'),
        supabase.from('financial_transactions').select('direction, amount').gte('occurred_at', start),
        supabase.from('purchases')
          .select('id, purchased_at, status, total_amount, suppliers(name)')
          .order('purchased_at', { ascending: false }).limit(5),
      ])
      for (const r of [stock, month, pending, cash, recent]) if (r.error) throw r.error

      const sum = (rows: unknown[] | null, key: string) =>
        (rows ?? []).reduce<number>((s, r) => s + Number((r as Record<string, unknown>)[key]), 0)

      const cashRows = (cash.data ?? []) as { direction: 'in' | 'out'; amount: number }[]
      return {
        stock: (stock.data ?? []) as Stock[],
        monthCount: (month.data ?? []).length,
        monthTotal: sum(month.data, 'total_amount'),
        pendingTotal: sum(pending.data, 'pending_amount'),
        // saídas pagas no mês, já descontando os estornos
        monthCashOut: cashRows.reduce(
          (s, r) => s + (r.direction === 'out' ? Number(r.amount) : -Number(r.amount)), 0),
        recent: (recent.data ?? []) as unknown as Recent[],
      }
    },
  })

  if (isLoading || !data) return <p>Carregando...</p>

  return (
    <>
      <div className="stats">
        <div className="stat"><span>Compras no mês</span><strong>{data.monthCount}</strong></div>
        <div className="stat"><span>Total comprado no mês</span><strong>{brl(data.monthTotal)}</strong></div>
        {isAdmin && (
          <div className="stat"><span>Pago no mês (caixa)</span><strong>{brl(data.monthCashOut)}</strong></div>
        )}
        <div className="stat"><span>Total a pagar</span><strong>{brl(data.pendingTotal)}</strong></div>
      </div>

      <div className="panel">
        <div className="row-between">
          <h3>Últimas compras</h3>
          <Link to="/compras/nova" className="btn">+ Nova compra</Link>
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