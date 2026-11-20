import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, PAYMENT_METHODS } from '../lib/format'

type Mat = { id: string; name: string; unit: 'kg' | 'un' }
type Bal = { material_id: string; balance: number }
type Cus = { id: string; name: string }
type Item = { key: string; materialId: string; quantity: string; unitPrice: string }
type Rec = { amount: number; method: string }

const newItem = (): Item => ({
    key: crypto.randomUUID(), materialId: '', quantity: '', unitPrice: '',
})
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function NewSale() {
    const companyId = useAuth().company!.id
    const navigate = useNavigate()
    const qc = useQueryClient()

    const [customerId, setCustomerId] = useState('')
    const [notes, setNotes] = useState('')
    const [items, setItems] = useState<Item[]>([newItem()])
    const [payMode, setPayMode] = useState<'full' | 'partial' | 'pending'>('full')
    const [payAmount, setPayAmount] = useState('')
    const [payMethod, setPayMethod] = useState('cash')
    const [msg, setMsg] = useState('')

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', 'sale', companyId],
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
            const { data, error } = await supabase
                .from('v_stock_balance')
                .select('material_id, balance')
            if (error) throw error
            return data as Bal[]
        },
    })

    const { data: customers = [] } = useQuery({
        queryKey: ['customers', 'select', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name')
                .eq('active', true)
                .order('name')
            if (error) throw error
            return data as Cus[]
        },
    })

    const balanceOf = (id: string) =>
        Number(balances.find((b) => b.material_id === id)?.balance ?? 0)

    const lineTotal = (it: Item) => Math.round(num(it.quantity) * num(it.unitPrice) * 100) / 100
    const total = Math.round(items.reduce((s, it) => s + lineTotal(it), 0) * 100) / 100

    const updateItem = (key: string, patch: Partial<Item>) =>
        setItems(items.map((it) => (it.key === key ? { ...it, ...patch } : it)))
    const removeItem = (key: string) => setItems(items.filter((it) => it.key !== key))

    const save = useMutation({
        mutationFn: async (receipts: Rec[]) => {
            const { error } = await supabase.rpc('create_sale', {
                p_company_id: companyId,
                p_customer_id: customerId || null,
                p_items: items.map((it) => ({
                    material_id: it.materialId,
                    quantity: num(it.quantity),
                    unit_price: num(it.unitPrice),
                })),
                p_receipts: receipts,
                p_notes: notes.trim() || null,
            })
            if (error) throw error
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales'] })
            qc.invalidateQueries({ queryKey: ['materials'] })
            qc.invalidateQueries({ queryKey: ['customers'] })
            navigate('/vendas')
        },
        onError: (e) => setMsg((e as { message?: string }).message ?? 'Erro ao salvar'),
    })

    function submit(e: FormEvent) {
        e.preventDefault()
        setMsg('')

        const used: Record<string, number> = {}
        for (const it of items) {
            if (!it.materialId) return setMsg('Escolha o material em todas as linhas.')
            if (num(it.quantity) <= 0) return setMsg('A quantidade precisa ser maior que zero.')
            if (num(it.unitPrice) <= 0) return setMsg('Informe o preço de venda em todas as linhas.')
            used[it.materialId] = (used[it.materialId] ?? 0) + num(it.quantity)
        }
        for (const [materialId, qty] of Object.entries(used)) {
            if (qty > balanceOf(materialId)) {
                const m = materials.find((x) => x.id === materialId)
                return setMsg(`Estoque insuficiente de ${m?.name}. Disponível: ${fmt(balanceOf(materialId))} ${m?.unit}.`)
            }
        }

        const receipts: Rec[] = []
        if (payMode === 'full' && total > 0) receipts.push({ amount: total, method: payMethod })
        if (payMode === 'partial') {
            const amount = num(payAmount)
            if (amount <= 0 || amount > total) {
                return setMsg('O valor recebido precisa ser maior que zero e não passar do total.')
            }
            receipts.push({ amount, method: payMethod })
        }
        save.mutate(receipts)
    }

    return (
        <form onSubmit={submit}>
            <div className="panel">
                <h2>Nova venda</h2>
                <div className="form-grid">
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                        <option value="">Venda avulsa (sem cliente)</option>
                        {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <input placeholder="Observações (opcional)" value={notes}
                        onChange={(e) => setNotes(e.target.value)} />
                </div>
            </div>

            <div className="panel">
                <h3>Materiais</h3>
                {materials.length === 0 && (
                    <p>Você ainda não cadastrou materiais. <Link to="/materiais">Cadastre aqui</Link>.</p>
                )}
                {items.map((it) => {
                    const mat = materials.find((m) => m.id === it.materialId)
                    return (
                        <div className="item-row" key={it.key}>
                            <select value={it.materialId}
                                onChange={(e) => updateItem(it.key, { materialId: e.target.value })}>
                                <option value="">Material...</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} — estoque: {fmt(balanceOf(m.id))} {m.unit}
                                    </option>
                                ))}
                            </select>
                            <input inputMode="decimal"
                                placeholder={mat?.unit === 'un' ? 'Quantidade (un)' : 'Peso (kg)'}
                                value={it.quantity}
                                onChange={(e) => updateItem(it.key, { quantity: e.target.value })} />
                            <input inputMode="decimal"
                                placeholder={mat?.unit === 'un' ? 'Preço por un' : 'Preço por kg'}
                                value={it.unitPrice}
                                onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })} />
                            <strong>{brl(lineTotal(it))}</strong>
                            <button type="button" className="btn danger"
                                disabled={items.length === 1} onClick={() => removeItem(it.key)}>
                                Remover
                            </button>
                        </div>
                    )
                })}
                <button type="button" className="btn secondary"
                    onClick={() => setItems([...items, newItem()])}>
                    + Adicionar material
                </button>
                <div className="total">Total: {brl(total)}</div>
            </div>

            <div className="panel">
                <h3>Recebimento</h3>
                <div className="form-grid">
                    <select value={payMode} onChange={(e) => setPayMode(e.target.value as typeof payMode)}>
                        <option value="full">Recebido total agora</option>
                        <option value="partial">Recebimento parcial</option>
                        <option value="pending">Receber depois (a prazo)</option>
                    </select>
                    {payMode === 'partial' && (
                        <input inputMode="decimal" placeholder="Valor recebido agora" value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)} />
                    )}
                    {payMode !== 'pending' && (
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                            {PAYMENT_METHODS.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {msg && <p className="msg">{msg}</p>}
            <div className="row-between">
                <Link to="/vendas" className="btn secondary">Cancelar</Link>
                <button className="btn" disabled={save.isPending}>
                    {save.isPending ? 'Salvando...' : 'Confirmar venda'}
                </button>
            </div>
        </form>
    )
}