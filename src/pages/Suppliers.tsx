import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Link } from 'react-router-dom'

type Supplier = {
  id: string
  name: string
  person_type: 'pf' | 'pj'
  document: string | null
  phone: string | null
}

const empty = { name: '', person_type: 'pf', document: '', phone: '', address: '', notes: '' }

export default function Suppliers() {
  const companyId = useAuth().company!.id
  const qc = useQueryClient()
  const [form, setForm] = useState(empty)
  const [msg, setMsg] = useState('')

  const set = (k: keyof typeof empty, v: string) => setForm({ ...form, [k]: v })

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, person_type, document, phone')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Supplier[]
    },
  })

  const add = useMutation({
    mutationFn: async () => {
      const digits = form.document.replace(/\D/g, '')
      const { error } = await supabase.from('suppliers').insert({
        company_id: companyId,
        person_type: form.person_type,
        name: form.name.trim(),
        document: digits || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setForm(empty); setMsg('')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (e) => {
      const err = e as { code?: string; message?: string }
      setMsg(err.code === '23505' ? 'Já existe um fornecedor com esse CPF/CNPJ.' : err.message ?? 'Erro')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    add.mutate()
  }

  return (
    <>
      <form className="panel" onSubmit={submit}>
        <h2>Novo fornecedor</h2>
        <div className="form-grid">
          <input placeholder="Nome" value={form.name}
            onChange={(e) => set('name', e.target.value)} required />
          <select value={form.person_type} onChange={(e) => set('person_type', e.target.value)}>
            <option value="pf">Pessoa física</option>
            <option value="pj">Pessoa jurídica</option>
          </select>
          <input placeholder={form.person_type === 'pf' ? 'CPF' : 'CNPJ'} inputMode="numeric"
            value={form.document} onChange={(e) => set('document', e.target.value)} />
          <input placeholder="Telefone" inputMode="tel" value={form.phone}
            onChange={(e) => set('phone', e.target.value)} />
          <input placeholder="Endereço" value={form.address}
            onChange={(e) => set('address', e.target.value)} />
          <input placeholder="Observações" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} />
          <button disabled={add.isPending}>Cadastrar</button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </form>

      <div className="panel">
        <h2>Fornecedores</h2>
        {isLoading ? <p>Carregando...</p> : suppliers.length === 0 ? (
          <p>Nenhum fornecedor cadastrado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
<td><Link to={`/fornecedores/${s.id}`}>{s.name}</Link></td>
                    <td>{s.person_type === 'pf' ? 'PF' : 'PJ'}</td>
                    <td>{s.document ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
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