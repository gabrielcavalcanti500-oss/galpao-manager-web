import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { brl, dateTime, num, PAYMENT_METHODS } from '../lib/format'
import { useAuth } from '../lib/auth'

type Detail = {
  id: string
  purchased_at: string
  status: 'confirmed' | 'cancelled'
  payment_status: 'pending' | 'partial' | 'paid'
  total_amount: number
  paid_amount: number
  notes: string | null
  created_by: string
  cancelled_at: string | null
  cancel_reason: string | null
  suppliers: { name: string } | null
  purchase_items: {
    id: string
    quantity: number
    unit_price: number
    subtotal: number
    materials: { name: string; unit: 'kg' | 'un' }
  }[]
  payments: { id: string; amount: number; method: string; paid_at: string }[]
}

const PAY_LABEL = { pending: 'Pendente', partial: 'Parcial', paid: 'Pago' } as const
const methodLabel = (m: string) => PAYMENT_METHODS.find(([v]) => v === m)?.[1] ?? m

export default function PurchaseDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const isAdmin = useAuth().company!.role !== 'operator'
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [msg, setMsg] = useState('')

  const { data: p, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(
          'id, purchased_at, status, payment_status, total_amount, paid_amount, notes, created_by, cancelled_at, cancel_reason, ' +
          'suppliers(name), ' +
          'purchase_items(id, quantity, unit_price, subtotal, materials(name, unit)), ' +
          'payments(id, amount, method, paid_at)',
        )
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as Detail
    },
  })

  const { data: author } = useQuery({
    queryKey: ['profile', p?.created_by],
    enabled: !!p,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', p!.created_by)
        .maybeSingle()
      return data as { full_name: string | null } | null
    },
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchase'] })
    qc.invalidateQueries({ queryKey: ['purchases'] })
    qc.invalidateQueries({ queryKey: ['materials'] })
  }
  const onError = (e: unknown) => setMsg((e as { message?: string }).message ?? 'Erro')

  const pay = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase.rpc('add_payment', {
        p_purchase_id: id,
        p_amount: value,
        p_method: method,
      })
      if (error) throw error
    },
    onSuccess: () => { setAmount(''); setMsg(''); refresh() },
    onError,
  })

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase.rpc('cancel_purchase', {
        p_purchase_id: id,
        p_reason: reason || null,
      })
      if (error) throw error
    },
    onSuccess: () => { setMsg(''); refresh() },
    onError,
  })

  if (isLoading) return <p>Carregando...</p>
  if (!p) return <p>Compra não encontrada.</p>

  const remaining = Math.round((p.total_amount - p.paid_amount) * 100) / 100

  function submitPayment(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    const value = num(amount)
    if (value <= 0 || value > remaining) {
      return setMsg(`Informe um valor entre R$ 0,01 e ${brl(remaining)}.`)
    }
    pay.mutate(value)
  }

  function askCancel() {
    if (!window.confirm('Cancelar esta compra? O estoque e os pagamentos serão estornados.')) return
    const reason = window.prompt('Motivo do cancelamento (opcional):')
    if (reason === null) return
    cancel.mutate(reason)
  }

  return (
    <>
      <div className="panel">
        <div className="row-between">
          <h2>Compra de {dateTime(p.purchased_at)}</h2>
          {p.status === 'cancelled'
            ? <span className="badge cancelled">Cancelada</span>
            : <span className={`badge ${p.payment_status}`}>{PAY_LABEL[p.payment_status]}</span>}
        </div>
        <p>Fornecedor: <strong>{p.suppliers?.name ?? 'Avulsa'}</strong></p>
        <p>Registrada por: {author?.full_name ?? '—'}</p>
        {p.notes && <p>Observações: {p.notes}</p>}
        {p.status === 'cancelled' && (
          <p className="msg">
            Cancelada em {p.cancelled_at ? dateTime(p.cancelled_at) : ''}
            {p.cancel_reason ? ` — ${p.cancel_reason}` : ''}
          </p>
        )}
      </div>

      <div className="panel">
        <h3>Itens</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Quantidade</th><th>Preço</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              {p.purchase_items.map((it) => (
                <tr key={it.id}>
                  <td>{it.materials.name}</td>
                  <td>
                    {Number(it.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {it.materials.unit}
                  </td>
                  <td>{brl(it.unit_price)}/{it.materials.unit}</td>
                  <td>{brl(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="total">Total: {brl(p.total_amount)}</div>
      </div>

      <div className="panel">
        <h3>Pagamentos</h3>
        {p.payments.length === 0 ? <p>Nenhum pagamento registrado.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Forma</th><th>Valor</th></tr></thead>
              <tbody>
                {[...p.payments]
                  .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
                  .map((x) => (
                    <tr key={x.id}>
                      <td>{dateTime(x.paid_at)}</td>
                      <td>{methodLabel(x.method)}</td>
                      <td>{brl(x.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p>Pago: <strong>{brl(p.paid_amount)}</strong> · Pendente: <strong>{brl(remaining)}</strong></p>

        {p.status === 'confirmed' && remaining > 0 && (
          <form onSubmit={submitPayment}>
            <div className="form-grid">
              <input inputMode="decimal" placeholder="Valor a pagar" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button type="button" className="btn secondary"
                onClick={() => setAmount(String(remaining).replace('.', ','))}>
                Quitar tudo
              </button>
              <button className="btn" disabled={pay.isPending}>Registrar pagamento</button>
            </div>
          </form>
        )}
      </div>

      {msg && <p className="msg">{msg}</p>}
      <div className="row-between">
        <Link to="/compras" className="btn secondary">Voltar</Link>
        {p.status === 'confirmed' && isAdmin && (
          <button className="btn danger" disabled={cancel.isPending} onClick={askCancel}>
            Cancelar compra
          </button>
        )}
      </div>
    </>
  )
}