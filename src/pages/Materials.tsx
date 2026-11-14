import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type StockRow = { material_id: string; name: string; unit: 'kg' | 'un'; balance: number }

export default function Materials() {
  const companyId = useAuth().company!.id
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<'kg' | 'un'>('kg')
  const [price, setPrice] = useState('')
  const [msg, setMsg] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['materials', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_stock_balance')
        .select('material_id, name, unit, balance')
        .order('name')
      if (error) throw error
      return data as StockRow[]
    },
  })

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('materials').insert({
        company_id: companyId,
        name: name.trim(),
        unit,
        default_buy_price: price ? Number(price.replace(',', '.')) : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setName(''); setPrice(''); setMsg('')
      qc.invalidateQueries({ queryKey: ['materials'] })
    },
    onError: (e) => {
      const err = e as { code?: string; message?: string }
      setMsg(err.code === '23505' ? 'Já existe um material com esse nome.' : err.message ?? 'Erro')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    add.mutate()
  }

  return (
    <>
      <form className="panel" onSubmit={submit}>
        <h2>Novo material</h2>
        <div className="form-grid">
          <input placeholder="Nome (ex.: Ferro, Alumínio)" value={name}
            onChange={(e) => setName(e.target.value)} required />
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'un')}>
            <option value="kg">Por kg</option>
            <option value="un">Por unidade</option>
          </select>
          <input placeholder="Preço padrão de compra (opcional)" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <button disabled={add.isPending}>Cadastrar</button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </form>

      <div className="panel">
        <h2>Materiais e estoque</h2>
        {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
          <p>Nenhum material cadastrado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Material</th><th>Unidade</th><th>Estoque</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.material_id}>
                    <td>{r.name}</td>
                    <td>{r.unit === 'kg' ? 'kg' : 'unidade'}</td>
                    <td>{Number(r.balance).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {r.unit}</td>
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