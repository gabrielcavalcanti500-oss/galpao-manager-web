import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dateTime } from '../lib/format'

type Row = {
  id: string
  purchased_at: string
  status: 'confirmed' | 'cancelled'
  payment_status: 'pending' | 'partial' | 'paid'
  total_amount: number
  paid_amount: number
  suppliers: { name: string } | null
}

const PAY_LABEL = { pending: 'Pendente', partial: 'Parcial', paid: 'Pago' } as const

export default function Purchases() {
  const companyId = useAuth().company!.id

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['purchases', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchased_at, status, payment_status, total_amount, paid_amount, suppliers(name)')
        .order('purchased_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as Row[]
    },
  })

  return (
    <div className="panel">
      <div className="row-between">
        <h2>Compras</h2>
        <Link to="/compras/nova" className="btn">+ Nova compra</Link>
      </div>
      {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
        <p>Nenhuma compra registrada ainda.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Fornecedor</th><th>Total</th>
                <th>Pago</th><th>Pendente</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
<td><Link to={`/compras/${r.id}`}>{dateTime(r.purchased_at)}</Link></td>                  <td>{r.suppliers?.name ?? 'Avulsa'}</td>
                  <td>{brl(r.total_amount)}</td>
                  <td>{brl(r.paid_amount)}</td>
                  <td>{brl(r.total_amount - r.paid_amount)}</td>
                  <td>
                    {r.status === 'cancelled'
                      ? <span className="badge cancelled">Cancelada</span>
                      : <span className={`badge ${r.payment_status}`}>{PAY_LABEL[r.payment_status]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}