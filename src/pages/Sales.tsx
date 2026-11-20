import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dateTime } from '../lib/format'

type Row = {
    id: string
    sold_at: string
    status: 'confirmed' | 'cancelled'
    payment_status: 'pending' | 'partial' | 'paid'
    total_amount: number
    received_amount: number
    customers: { name: string } | null
}

const PAY_LABEL = { pending: 'A receber', partial: 'Parcial', paid: 'Recebido' } as const

export default function Sales() {
    const companyId = useAuth().company!.id

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['sales', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales')
                .select('id, sold_at, status, payment_status, total_amount, received_amount, customers(name)')
                .order('sold_at', { ascending: false })
                .limit(100)
            if (error) throw error
            return data as unknown as Row[]
        },
    })

    return (
        <div className="panel">
            <div className="row-between">
                <h2>Vendas</h2>
                <Link to="/vendas/nova" className="btn">+ Nova venda</Link>
            </div>
            {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
                <p>Nenhuma venda registrada ainda.</p>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th><th>Cliente</th><th>Total</th>
                                <th>Recebido</th><th>A receber</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td><Link to={`/vendas/${r.id}`}>{dateTime(r.sold_at)}</Link></td>
                                    <td>{r.customers?.name ?? 'Avulsa'}</td>
                                    <td>{brl(r.total_amount)}</td>
                                    <td>{brl(r.received_amount)}</td>
                                    <td>{brl(r.total_amount - r.received_amount)}</td>
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