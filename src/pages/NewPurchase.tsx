import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, PAYMENT_METHODS } from '../lib/format'

type Mat = { id: string; name: string; unit: 'kg' | 'un'; default_buy_price: number | null }
type Sup = { id: string; name: string }
type Item = { key: string; materialId: string; quantity: string; unitPrice: string }
type Pay = { amount: number; method: string }

const newItem = (): Item => ({
  key: crypto.randomUUID(), materialId: '', quantity: '', unitPrice: '',
})

export default function NewPurchase() {
  const companyId = useAuth().company!.id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>([newItem()])
  const [payMode, setPayMode] = useState<'full' | 'partial' | 'pending'>('full')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [msg, setMsg] = useState('')

  const { data: materials = [] } = useQuery({
    queryKey: ['materials', 'select', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, default_buy_price')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Mat[]
    },
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'select', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Sup[]
    },
  })

  const lineTotal = (it: Item) => Math.round(num(it.quantity) * num(it.unitPrice) * 100) / 100
  const total = Math.round(items.reduce((s, it) => s + lineTotal(it), 0) * 100) / 100

  const updateItem = (key: string, patch: Partial<Item>) =>
    setItems(items.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  const removeItem = (key: string) => setItems(items.filter((it) => it.key !== key))

  function pickMaterial(key: string, materialId: string) {
    const m = materials.find((x) => x.id === materialId)
    updateItem(key, {
      materialId,
      ...(m?.default_buy_price != null
        ? { unitPrice: String(m.default_buy_price).replace('.', ',') }
        : {}),
    })
  }

  const save = useMutation({
    mutationFn: async (payments: Pay[]) => {
      const { error } = await supabase.rpc('create_purchase', {
        p_company_id: companyId,
        p_supplier_id: supplierId || null,
        p_items: items.map((it) => ({
          material_id: it.materialId,
          quantity: num(it.quantity),
          unit_price: num(it.unitPrice),
        })),
        p_payments: payments,
        p_notes: notes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['materials'] })
      navigate('/compras')
    },
    onError: (e) => setMsg((e as { message?: string }).message ?? 'Erro ao salvar'),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    for (const it of items) {
      if (!it.materialId) return setMsg('Escolha o material em todas as linhas.')
      if (num(it.quantity) <= 0) return setMsg('A quantidade precisa ser maior que zero.')
    }
    const payments: Pay[] = []
    if (payMode === 'full' && total > 0) payments.push({ amount: total, method: payMethod })
    if (payMode === 'partial') {
      const amount = num(payAmount)
      if (amount <= 0 || amount > total) {
        return setMsg('O valor pago precisa ser maior que zero e não passar do total.')
      }
      payments.push({ amount, method: payMethod })
    }
    save.mutate(payments)
  }

  return (
    <form onSubmit={submit}>
      <div className="panel">
        <h2>Nova compra</h2>
        <div className="form-grid">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Compra avulsa (sem fornecedor)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
              <select value={it.materialId} onChange={(e) => pickMaterial(it.key, e.target.value)}>
                <option value="">Material...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
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
        <h3>Pagamento</h3>
        <div className="form-grid">
          <select value={payMode} onChange={(e) => setPayMode(e.target.value as typeof payMode)}>
            <option value="full">Pago total agora</option>
            <option value="partial">Pagamento parcial</option>
            <option value="pending">Pagar depois (pendente)</option>
          </select>
          {payMode === 'partial' && (
            <input inputMode="decimal" placeholder="Valor pago agora" value={payAmount}
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
        <Link to="/compras" className="btn secondary">Cancelar</Link>
        <button className="btn" disabled={save.isPending}>
          {save.isPending ? 'Salvando...' : 'Confirmar compra'}
        </button>
      </div>
    </form>
  )
}