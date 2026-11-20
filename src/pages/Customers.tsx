import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl } from '../lib/format'

type Customer = {
    id: string
    name: string
    person_type: 'pf' | 'pj'
    document: string | null
    phone: string | null
    address: string | null
    notes: string | null
}

const empty = { name: '', person_type: 'pf', document: '', phone: '', address: '', notes: '' }

export default function Customers() {
    const companyId = useAuth().company!.id
    const qc = useQueryClient()
    const [form, setForm] = useState(empty)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [msg, setMsg] = useState('')

    const set = (k: keyof typeof empty, v: string) => setForm({ ...form, [k]: v })

    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, person_type, document, phone, address, notes')
                .eq('active', true)
                .order('name')
            if (error) throw error
            return data as Customer[]
        },
    })

    const { data: totals = [] } = useQuery({
        queryKey: ['customers', 'totals', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_customer_totals')
                .select('customer_id, pending_amount')
            if (error) throw error
            return data as { customer_id: string | null; pending_amount: number }[]
        },
    })

    const pendingOf = (id: string) =>
        Number(totals.find((t) => t.customer_id === id)?.pending_amount ?? 0)

    const refresh = () => qc.invalidateQueries({ queryKey: ['customers'] })

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
                ? await supabase.from('customers').update(payload).eq('id', editingId)
                : await supabase.from('customers').insert({ company_id: companyId, ...payload })
            if (error) throw error
        },
        onSuccess: () => {
            setForm(empty); setEditingId(null); setMsg('')
            refresh()
        },
        onError: (e) => {
            const err = e as { code?: string; message?: string }
            setMsg(err.code === '23505' ? 'Já existe um cliente com esse CPF/CNPJ.' : err.message ?? 'Erro')
        },
    })

    const deactivate = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('customers').update({ active: false }).eq('id', id)
            if (error) throw error
        },
        onSuccess: refresh,
        onError: (e) => setMsg((e as { message?: string }).message ?? 'Erro'),
    })

    function startEdit(c: Customer) {
        setEditingId(c.id)
        setForm({
            name: c.name,
            person_type: c.person_type,
            document: c.document ?? '',
            phone: c.phone ?? '',
            address: c.address ?? '',
            notes: c.notes ?? '',
        })
        setMsg('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function cancelEdit() {
        setEditingId(null)
        setForm(empty)
        setMsg('')
    }

    function askDeactivate(c: Customer) {
        if (window.confirm(`Inativar "${c.name}"? As vendas antigas dele continuam no histórico.`)) {
            deactivate.mutate(c.id)
        }
    }

    function submit(e: FormEvent) {
        e.preventDefault()
        save.mutate()
    }

    return (
        <>
            <form className="panel" onSubmit={submit}>
                <h2>{editingId ? 'Editar cliente' : 'Novo cliente'}</h2>
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
                <h2>Clientes</h2>
                {isLoading ? <p>Carregando...</p> : customers.length === 0 ? (
                    <p>Nenhum cliente cadastrado ainda.</p>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th>A receber</th><th></th></tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr key={c.id}>
                                        <td>{c.name}</td>
                                        <td>{c.person_type === 'pf' ? 'PF' : 'PJ'}</td>
                                        <td>{c.document ?? '—'}</td>
                                        <td>{c.phone ?? '—'}</td>
                                        <td>{brl(pendingOf(c.id))}</td>
                                        <td>
                                            <div className="actions">
                                                <button className="btn secondary small" onClick={() => startEdit(c)}>Editar</button>
                                                <button className="btn danger small" onClick={() => askDeactivate(c)}>Inativar</button>
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