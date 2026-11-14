import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num } from '../lib/format'

type Mat = { id: string; name: string; unit: 'kg' | 'un'; default_buy_price: number | null }
type Bal = { material_id: string; balance: number }

export default function Materials() {
  const companyId = useAuth().company!.id
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<'kg' | 'un'>('kg')
  const [price, setPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const { data: mats = [], isLoading } = useQuery({
    queryKey: ['materials', companyId],
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

  const balanceOf = (id: string) =>
    Number(balances.find((b) => b.material_id === id)?.balance ?? 0)

  const refresh = () => qc.invalidateQueries({ queryKey: ['materials'] })

  const save = useMutation({
    mutationFn: async () => {
      const default_buy_price = price.trim() ? num(price) : null
      const { error } = editingId
        ? await supabase
            .from('materials')
            .update({ name: name.trim(), default_buy_price })
            .eq('id', editingId)
        : await supabase
            .from('materials')
            .insert({ company_id: companyId, name: name.trim(), unit, default_buy_price })
      if (error) throw error
    },
    onSuccess: () => {
      setName(''); setPrice(''); setUnit('kg'); setEditingId(null); setMsg('')
      refresh()
    },
    onError: (e) => {
      const err = e as { code?: string; message?: string }
      setMsg(err.code === '23505' ? 'Já existe um material com esse nome.' : err.message ?? 'Erro')
    },
  })

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materials').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e) => setMsg((e as { message?: string }).message ?? 'Erro'),
  })

  function startEdit(m: Mat) {
    setEditingId(m.id)
    setName(m.name)
    setUnit(m.unit)
    setPrice(m.default_buy_price != null ? String(m.default_buy_price).replace('.', ',') : '')
    setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null); setName(''); setPrice(''); setUnit('kg'); setMsg('')
  }

  function askDeactivate(m: Mat) {
    if (balanceOf(m.id) !== 0) {
      return setMsg(`Só dá para inativar "${m.name}" com o estoque zerado.`)
    }
    if (window.confirm(`Inativar "${m.name}"? O histórico de compras continua guardado.`)) {
      setMsg('')
      deactivate.mutate(m.id)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <>
      <form className="panel" onSubmit={submit}>
        <h2>{editingId ? 'Editar material' : 'Novo material'}</h2>
        <div className="form-grid">
          <input placeholder="Nome (ex.: Ferro, Alumínio)" value={name}
            onChange={(e) => setName(e.target.value)} required />
          <select value={unit} disabled={!!editingId}
            onChange={(e) => setUnit(e.target.value as 'kg' | 'un')}>
            <option value="kg">Por kg</option>
            <option value="un">Por unidade</option>
          </select>
          <input placeholder="Preço padrão de compra (opcional)" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <button disabled={save.isPending}>{editingId ? 'Salvar alterações' : 'Cadastrar'}</button>
          {editingId && (
            <button type="button" className="btn secondary" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
        {editingId && <p>A unidade não pode ser alterada depois de criada.</p>}
        {msg && <p className="msg">{msg}</p>}
      </form>

      <div className="panel">
        <h2>Materiais e estoque</h2>
        {isLoading ? <p>Carregando...</p> : mats.length === 0 ? (
          <p>Nenhum material cadastrado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Material</th><th>Estoque</th><th>Preço padrão</th><th></th></tr>
              </thead>
              <tbody>
                {mats.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>
                      {balanceOf(m.id).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {m.unit}
                    </td>
                    <td>{m.default_buy_price != null ? `${brl(m.default_buy_price)}/${m.unit}` : '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="btn secondary small" onClick={() => startEdit(m)}>Editar</button>
                        <button className="btn danger small" onClick={() => askDeactivate(m)}>Inativar</button>
                      </div>
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