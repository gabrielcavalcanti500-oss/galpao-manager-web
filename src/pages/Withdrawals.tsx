import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
    brl, dayStartISO, monthStartInput, nextDayStartISO, num, todayInput,
} from '../lib/format'

type Kind = 'loss' | 'own_use' | 'correction_out' | 'correction_in'

const KIND_LABEL: Record<Kind, string> = {
    loss: 'Perda / quebra',
    own_use: 'Uso próprio',
    correction_out: 'Ajuste de contagem (−)',
    correction_in: 'Ajuste de contagem (+)',
}

type Mat = { id: string; name: string; unit: 'kg' | 'un' }
type Bal = { material_id: string; balance: number }
type Row = {
    id: string
    kind: Kind
    quantity: number
    unit_cost: number
    notes: string | null
    occurred_at: string
    status: 'confirmed' | 'cancelled'
    cancel_reason: string | null
    materials: { name: string; unit: 'kg' | 'un' }
}

const fmt = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export default function Withdrawals() {
    const companyId = useAuth().company!.id
    const qc = useQueryClient()

    const [materialId, setMaterialId] = useState('')
    const [kind, setKind] = useState<Kind>('loss')
    const [quantity, setQuantity] = useState('')
    const [notes, setNotes] = useState('')
    const [from, setFrom] = useState(monthStartInput())
    const [to, setTo] = useState(todayInput())
    const [msg, setMsg] = useState('')

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', 'withdraw', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('materials')
                .select('id, name, unit')
                .eq('active', true)
                .order('name')
            if (error) throw error
            return data as Mat[]
        },
    })

    const { data: balances = [] } = useQuery({
        queryKey: ['materials', 'balance', companyId],
        queryFn: async () => {
            const { data, error } = await supabase.from('v_stock_balance').select('material_id, balance')
            if (error) throw error
            return data as Bal[]
        },
    })

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['withdrawals', companyId, from, to],
        queryFn: async () => {
            let q = supabase
                .from('stock_adjustments')
                .select('id, kind, quantity, unit_cost, notes, occurred_at, status, cancel_reason, materials(name, unit)')
                .order('occurred_at', { ascending: false })
            if (from) q = q.gte('occurred_at', dayStartISO(from))
            if (to) q = q.lt('occurred_at', nextDayStartISO(to))
            const { data, error } = await q
            if (error) throw error
            return data as unknown as Row[]
        },
    })

    const balanceOf = (id: string) =>
        Number(balances.find((b) => b.material_id === id)?.balance ?? 0)

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['withdrawals'] })
        qc.invalidateQueries({ queryKey: ['materials'] })
    }
    const onError = (e: unknown) => setMsg((e as { message?: string }).message ?? 'Erro')

    const save = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('create_stock_adjustment', {
                p_company_id: companyId,
                p_material_id: materialId,
                p_kind: kind,
                p_quantity: num(quantity),
                p_notes: notes.trim() || null,
            })
            if (error) throw error
        },
        onSuccess: () => {
            setQuantity(''); setNotes(''); setMsg('')
            refresh()
        },
        onError,
    })

    const cancel = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const { error } = await supabase.rpc('cancel_stock_adjustment', {
                p_id: id,
                p_reason: reason || null,
            })
            if (error) throw error
        },
        onSuccess: () => { setMsg(''); refresh() },
        onError,
    })

    function submit(e: FormEvent) {
        e.preventDefault()
        setMsg('')
        const mat = materials.find((m) => m.id === materialId)
        if (!mat) return setMsg('Escolha o material.')
        const qty = num(quantity)
        if (qty <= 0) return setMsg('A quantidade precisa ser maior que zero.')
        if (kind !== 'correction_in' && qty > balanceOf(mat.id)) {
            return setMsg(`Estoque insuficiente de ${mat.name}. Disponível: ${fmt(balanceOf(mat.id))} ${mat.unit}.`)
        }
        if ((kind === 'correction_in' || kind === 'correction_out') && !notes.trim()) {
            return setMsg('Informe o motivo do ajuste de contagem.')
        }
        save.mutate()
    }

    function askCancel(x: Row) {
        if (!window.confirm('Cancelar este registro? O estoque volta ao que era antes.')) return
        const reason = window.prompt('Motivo do cancelamento (opcional):')
        if (reason === null) return
        cancel.mutate({ id: x.id, reason })
    }

    const valid = rows.filter((r) => r.status === 'confirmed' && r.kind !== 'correction_in')
    const costTotal = valid.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0)

    return (
        <>
            <form className="panel" onSubmit={submit}>
                <h2>Nova retirada / ajuste</h2>
                <div className="form-grid">
                    <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                        <option value="">Material...</option>
                        {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name} — estoque: {fmt(balanceOf(m.id))} {m.unit}
                            </option>
                        ))}
                    </select>
                    <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                            <option key={k} value={k}>{KIND_LABEL[k]}</option>
                        ))}
                    </select>
                    <input inputMode="decimal" placeholder="Quantidade" value={quantity}
                        onChange={(e) => setQuantity(e.target.value)} />
                    <input
                        placeholder={kind.startsWith('correction') ? 'Motivo (obrigatório)' : 'Observações (opcional)'}
                        value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <button disabled={save.isPending}>Registrar</button>
                </div>
                {msg && <p className="msg">{msg}</p>}
            </form>

            <div className="panel">
                <h3>Registros do período</h3>
                <div className="filters">
                    <label>De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label>Até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
                </div>
                <div className="stats">
                    <div className="stat"><span>Custo estimado das baixas</span><strong>{brl(costTotal)}</strong></div>
                </div>

                {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
                    <p>Nenhum registro neste período.</p>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Data</th><th>Material</th><th>Tipo</th><th>Qtd.</th><th>Custo est.</th><th>Motivo</th><th></th></tr>
                            </thead>
                            <tbody>
                                {rows.map((x) => (
                                    <tr key={x.id}>
                                        <td>{dateOnly(x.occurred_at)}</td>
                                        <td>{x.materials.name}</td>
                                        <td>{KIND_LABEL[x.kind]}</td>
                                        <td>{x.kind === 'correction_in' ? '+' : '−'}{fmt(x.quantity)} {x.materials.unit}</td>
                                        <td>{Number(x.unit_cost) > 0 ? brl(Number(x.quantity) * Number(x.unit_cost)) : '—'}</td>
                                        <td>{x.notes ?? '—'}</td>
                                        <td>
                                            {x.status === 'cancelled'
                                                ? <span className="badge cancelled" title={x.cancel_reason ?? ''}>Cancelado</span>
                                                : <button className="btn danger small" onClick={() => askCancel(x)}>Cancelar</button>}
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