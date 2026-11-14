import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Supplier = {
  id: string
  name: string
  person_type: 'pf' | 'pj'
  document: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

const empty = { name: '', person_type: 'pf', document: '', phone: '', address: '', notes: '' }

export default function Suppliers() {
  const companyId = useAuth().company!.id
  const qc = useQueryClient()
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const set = (k: keyof typeof empty, v: string) => setForm({ ...form, [k]: v })

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, person_type, document, phone, address, notes')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data as Supplier[]
    },
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['suppliers'] })
    qc.invalidateQueries({ queryKey: ['supplier'] })
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        person_type: form.person_type,
        name: form.name.trim(),
        document: form.document.replace(/\D/g, '') || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }
      const { error } = editingId
        ? await supabase.from('suppliers').update(payload).eq('id', editingId)
        : await supabase.from('suppliers').insert({ company_id: companyId, ...payload })
      if (error) throw error
    },
    onSuccess: () => {
      setForm(empty); setEditingId(null); setMsg('')
      refresh()
    },
    onError: (e) => {
      const err = e as { code?: string; message?: string }
      setMsg(err.code === '23505' ? 'Já existe um fornecedor com esse CPF/CNPJ.' : err.message ?? 'Erro')
    },
  })

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e) => setMsg((e as { message?: string }).message ?? 'Erro'),
  })

  function startEdit(s: Supplier) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      person_type: s.person_type,
      document: s.document ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    })
    setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(empty)
    setMsg('')
  }

  function askDeactivate(s: Supplier) {
    if (window.confirm(`Inativar "${s.name}"? As compras antigas dele continuam no histórico.`)) {
      deactivate.mutate(s.id)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <>
      <form className="panel" onSubmit={submit}>
        <h2>{editingId ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
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
          <button disabled={save.isPending}>{editingId ? 'Salvar alterações' : 'Cadastrar'}</button>
          {editingId && (
            <button type="button" className="btn secondary" onClick={cancelEdit}>Cancelar</button>
          )}
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
              <thead>
                <tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th></th></tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/fornecedores/${s.id}`}>{s.name}</Link></td>
                    <td>{s.person_type === 'pf' ? 'PF' : 'PJ'}</td>
                    <td>{s.document ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="btn secondary small" onClick={() => startEdit(s)}>Editar</button>
                        <button className="btn danger small" onClick={() => askDeactivate(s)}>Inativar</button>
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