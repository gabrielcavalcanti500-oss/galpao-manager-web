import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dateTime, num, PAYMENT_METHODS } from '../lib/format'

type Detail = {
    id: string
    sold_at: string
    status: 'confirmed' | 'cancelled'
    payment_status: 'pending' | 'partial' | 'paid'
    total_amount: number
    received_amount: number
    notes: string | null
    created_by: string
    cancelled_at: string | null
    cancel_reason: string | null
    customers: { name: string } | null
    sale_items: {
        id: string
        quantity: number
        unit_price: number
        subtotal: number
        materials: { name: string; unit: 'kg' | 'un' }
    }[]
    sale_receipts: { id: string; amount: number; method: string; received_at: string }[]
}

const PAY_LABEL = { pending: 'A receber', partial: 'Parcial', paid: 'Recebido' } as const
const methodLabel = (m: string) => PAYMENT_METHODS.find(([v]) => v === m)?.[1] ?? m

export default function SaleDetail() {
    const { id } = useParams()
    const qc = useQueryClient()
    const isAdmin = useAuth().company!.role !== 'operator'
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('cash')
    const [msg, setMsg] = useState('')

    const { data: s, isLoading } = useQuery({
        queryKey: ['sale', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales')
                .select(
                    'id, sold_at, status, payment_status, total_amount, received_amount, notes, created_by, cancelled_at, cancel_reason, ' +
                    'customers(name), ' +
                    'sale_items(id, quantity, unit_price, subtotal, materials(name, unit)), ' +
                    'sale_receipts(id, amount, method, received_at)',
                )
                .eq('id', id!)
                .single()
            if (error) throw error
            return data as unknown as Detail
        },
    })

    const { data: author } = useQuery({
        queryKey: ['profile', s?.created_by],
        enabled: !!s,
        queryFn: async () => {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', s!.created_by)
                .maybeSingle()
            return data as { full_name: string | null } | null
        },
    })

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['sale'] })
        qc.invalidateQueries({ queryKey: ['sales'] })
        qc.invalidateQueries({ queryKey: ['materials'] })
        qc.invalidateQueries({ queryKey: ['customers'] })
    }
    const onError = (e: unknown) => setMsg((e as { message?: string }).message ?? 'Erro')

    const receive = useMutation({
        mutationFn: async (value: number) => {
            const { error } = await supabase.rpc('add_receipt', {
                p_sale_id: id,
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
            const { error } = await supabase.rpc('cancel_sale', {
                p_sale_id: id,
                p_reason: reason || null,
            })
            if (error) throw error
        },
        onSuccess: () => { setMsg(''); refresh() },
        onError,
    })

    if (isLoading) return <p>Carregando...</p>
    if (!s) return <p>Venda não encontrada.</p>

    const remaining = Math.round((s.total_amount - s.received_amount) * 100) / 100

    function submitReceipt(e: FormEvent) {
        e.preventDefault()
        setMsg('')
        const value = num(amount)
        if (value <= 0 || value > remaining) {
            return setMsg(`Informe um valor entre R$ 0,01 e ${brl(remaining)}.`)
        }
        receive.mutate(value)
    }

    function askCancel() {
        if (!window.confirm('Cancelar esta venda? O material volta ao estoque e os recebimentos são estornados.')) return
        const reason = window.prompt('Motivo do cancelamento (opcional):')
        if (reason === null) return
        cancel.mutate(reason)
    }

    return (
        <>
            <div className="panel">
                <div className="row-between">
                    <h2>Venda de {dateTime(s.sold_at)}</h2>
                    {s.status === 'cancelled'
                        ? <span className="badge cancelled">Cancelada</span>
                        : <span className={`badge ${s.payment_status}`}>{PAY_LABEL[s.payment_status]}</span>}
                </div>
                <p>Cliente: <strong>{s.customers?.name ?? 'Avulsa'}</strong></p>
                <p>Registrada por: {author?.full_name ?? '—'}</p>
                {s.notes && <p>Observações: {s.notes}</p>}
                {s.status === 'cancelled' && (
                    <p className="msg">
                        Cancelada em {s.cancelled_at ? dateTime(s.cancelled_at) : ''}
                        {s.cancel_reason ? ` — ${s.cancel_reason}` : ''}
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
                            {s.sale_items.map((it) => (
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
                <div className="total">Total: {brl(s.total_amount)}</div>
            </div>

            <div className="panel">
                <h3>Recebimentos</h3>
                {s.sale_receipts.length === 0 ? <p>Nenhum recebimento registrado.</p> : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Data</th><th>Forma</th><th>Valor</th></tr></thead>
                            <tbody>
                                {[...s.sale_receipts]
                                    .sort((a, b) => a.received_at.localeCompare(b.received_at))
                                    .map((x) => (
                                        <tr key={x.id}>
                                            <td>{dateTime(x.received_at)}</td>
                                            <td>{methodLabel(x.method)}</td>
                                            <td>{brl(x.amount)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p>Recebido: <strong>{brl(s.received_amount)}</strong> · A receber: <strong>{brl(remaining)}</strong></p>

                {s.status === 'confirmed' && remaining > 0 && (
                    <form onSubmit={submitReceipt}>
                        <div className="form-grid">
                            <input inputMode="decimal" placeholder="Valor recebido" value={amount}
                                onChange={(e) => setAmount(e.target.value)} />
                            <select value={method} onChange={(e) => setMethod(e.target.value)}>
                                {PAYMENT_METHODS.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                            <button type="button" className="btn secondary"
                                onClick={() => setAmount(String(remaining).replace('.', ','))}>
                                Receber tudo
                            </button>
                            <button className="btn" disabled={receive.isPending}>Registrar recebimento</button>
                        </div>
                    </form>
                )}
            </div>

            {msg && <p className="msg">{msg}</p>}
            <div className="row-between">
                <Link to="/vendas" className="btn secondary">Voltar</Link>
                {s.status === 'confirmed' && isAdmin && (
                    <button className="btn danger" disabled={cancel.isPending} onClick={askCancel}>
                        Cancelar venda
                    </button>
                )}
            </div>
        </>
    )
}