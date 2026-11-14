import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  brl, dateTime, dayStartISO, monthStartInput, nextDayStartISO, todayInput,
} from '../lib/format'

type Supplier = {
  id: string
  name: string
  person_type: 'pf' | 'pj'
  document: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

type Row = {
  id: string
  purchased_at: string
  status: 'confirmed' | 'cancelled'
  payment_status: 'pending' | 'partial' | 'paid'
  total_amount: number
  paid_amount: number
}

const PAY_LABEL = { pending: 'Pendente', partial: 'Parcial', paid: 'Pago' } as const

export default function SupplierDetail() {
  const { id } = useParams()
  const [from, setFrom] = useState(monthStartInput())
  const [to, setTo] = useState(todayInput())

  const { data: s } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, person_type, document, phone, address, notes')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Supplier
    },
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['purchases', 'supplier', id, from, to],
    queryFn: async () => {
      let q = supabase
        .from('purchases')
        .select('id, purchased_at, status, payment_status, total_amount, paid_amount')
        .eq('supplier_id', id!)
        .order('purchased_at', { ascending: false })
      if (from) q = q.gte('purchased_at', dayStartISO(from))
      if (to) q = q.lt('purchased_at', nextDayStartISO(to))
      const { data, error } = await q
      if (error) throw error
      return data as Row[]
    },
  })

  // cancelada não entra nos totais
  const valid = rows.filter((r) => r.status === 'confirmed')
  const total = valid.reduce((sum, r) => sum + Number(r.total_amount), 0)
  const paid = valid.reduce((sum, r) => sum + Number(r.paid_amount), 0)

  if (!s) return <p>Carregando...</p>

  return (
    <>
      <div className="panel">
        <div className="row-between">
          <h2>{s.name}</h2>
          <Link to="/fornecedores" className="btn secondary">Voltar</Link>
        </div>
        <p>
          {s.person_type === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
          {s.document ? ` · ${s.document}` : ''}
          {s.phone ? ` · ${s.phone}` : ''}
        </p>
        {s.address && <p>Endereço: {s.address}</p>}
        {s.notes && <p>Observações: {s.notes}</p>}
      </div>

      <div className="panel">
        <h3>Valores movimentados</h3>
        <div className="filters">
          <label>De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="stats">
          <div className="stat"><span>Compras</span><strong>{valid.length}</strong></div>
          <div className="stat"><span>Total comprado</span><strong>{brl(total)}</strong></div>
          <div className="stat"><span>Total pago</span><strong>{brl(paid)}</strong></div>
          <div className="stat"><span>Pendente</span><strong>{brl(total - paid)}</strong></div>
        </div>

        {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
          <p>Nenhuma compra neste período.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Total</th><th>Pago</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/compras/${r.id}`}>{dateTime(r.purchased_at)}</Link></td>
                    <td>{brl(r.total_amount)}</td>
                    <td>{brl(r.paid_amount)}</td>
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
    </>
  )
}