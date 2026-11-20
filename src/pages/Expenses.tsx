import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
    brl, dayStartISO, monthStartInput, nextDayStartISO, num, PAYMENT_METHODS, todayInput,
} from '../lib/format'

type Category = { id: string; name: string }
type Expense = {
    id: string
    description: string | null
    amount: number
    method: string
    spent_at: string
    status: 'confirmed' | 'cancelled'
    cancel_reason: string | null
    expense_categories: { name: string } | null
}

const methodLabel = (m: string) => PAYMENT_METHODS.find(([v]) => v === m)?.[1] ?? m
const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export default function Expenses() {
    const companyId = useAuth().company!.id
    const qc = useQueryClient()

    const [categoryId, setCategoryId] = useState('')
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('cash')
    const [date, setDate] = useState(todayInput())
    const [newCategory, setNewCategory] = useState('')
    const [from, setFrom] = useState(monthStartInput())
    const [to, setTo] = useState(todayInput())
    const [msg, setMsg] = useState('')

    const { data: categories = [] } = useQuery({
        queryKey: ['expenses', 'categories', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('expense_categories')
                .select('id, name')
                .eq('active', true)
                .order('name')
            if (error) throw error
            return data as Category[]
        },
    })

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ['expenses', 'list', companyId, from, to],
        queryFn: async () => {
            let q = supabase
                .from('expenses')
                .select('id, description, amount, method, spent_at, status, cancel_reason, expense_categories(name)')
                .order('spent_at', { ascending: false })
            if (from) q = q.gte('spent_at', dayStartISO(from))
            if (to) q = q.lt('spent_at', nextDayStartISO(to))
            const { data, error } = await q
            if (error) throw error
            return data as unknown as Expense[]
        },
    })

    const refresh = () => qc.invalidateQueries({ queryKey: ['expenses'] })
    const onError = (e: unknown) => setMsg((e as { message?: string }).message ?? 'Erro')

    const save = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('create_expense', {
                p_company_id: companyId,
                p_category_id: categoryId,
                p_description: description,
                p_amount: num(amount),
                p_method: method,
                // meio-dia evita que o fuso horário jogue o gasto para o dia anterior
                p_spent_at: new Date(`${date}T12:00:00`).toISOString(),
            })
            if (error) throw error
        },
        onSuccess: () => {
            setDescription(''); setAmount(''); setMsg('')
            refresh()
        },
        onError,
    })

    const addCategory = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('expense_categories')
                .insert({ company_id: companyId, name: newCategory.trim() })
            if (error) throw error
        },
        onSuccess: () => { setNewCategory(''); setMsg(''); refresh() },
        onError: (e) => {
            const err = e as { code?: string; message?: string }
            setMsg(err.code === '23505' ? 'Já existe uma categoria com esse nome.' : err.message ?? 'Erro')
        },
    })

    const cancel = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const { error } = await supabase.rpc('cancel_expense', {
                p_expense_id: id,
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
        if (!categoryId) return setMsg('Escolha a categoria.')
        if (num(amount) <= 0) return setMsg('Informe um valor maior que zero.')
        save.mutate()
    }

    function askCancel(x: Expense) {
        if (!window.confirm(`Cancelar o gasto de ${brl(x.amount)}? O valor será estornado no caixa.`)) return
        const reason = window.prompt('Motivo do cancelamento (opcional):')
        if (reason === null) return
        cancel.mutate({ id: x.id, reason })
    }

    // cancelado não entra nos totais
    const valid = rows.filter((r) => r.status === 'confirmed')
    const total = valid.reduce((s, r) => s + Number(r.amount), 0)
    const byCategory = Object.entries(
        valid.reduce<Record<string, number>>((acc, r) => {
            const name = r.expense_categories?.name ?? 'Sem categoria'
            acc[name] = (acc[name] ?? 0) + Number(r.amount)
            return acc
        }, {}),
    ).sort((a, b) => b[1] - a[1])

    return (
        <>
            <form className="panel" onSubmit={submit}>
                <h2>Novo gasto</h2>
                <div className="form-grid">
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">Categoria...</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <input placeholder="Descrição (opcional)" value={description}
                        onChange={(e) => setDescription(e.target.value)} />
                    <input inputMode="decimal" placeholder="Valor" value={amount}
                        onChange={(e) => setAmount(e.target.value)} />
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        {PAYMENT_METHODS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <input type="date" value={date} max={todayInput()}
                        onChange={(e) => setDate(e.target.value)} required />
                    <button disabled={save.isPending}>Registrar gasto</button>
                </div>
                {msg && <p className="msg">{msg}</p>}

                <div className="form-grid" style={{ marginTop: 14 }}>
                    <input placeholder="Nova categoria (ex.: Aluguel)" value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)} />
                    <button type="button" className="btn secondary"
                        disabled={!newCategory.trim() || addCategory.isPending}
                        onClick={() => addCategory.mutate()}>
                        Criar categoria
                    </button>
                </div>
            </form>

            <div className="panel">
                <h3>Gastos do período</h3>
                <div className="filters">
                    <label>De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label>Até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
                </div>

                <div className="stats">
                    <div className="stat"><span>Total no período</span><strong>{brl(total)}</strong></div>
                    {byCategory.slice(0, 3).map(([name, value]) => (
                        <div className="stat" key={name}><span>{name}</span><strong>{brl(value)}</strong></div>
                    ))}
                </div>

                {isLoading ? <p>Carregando...</p> : rows.length === 0 ? (
                    <p>Nenhum gasto neste período.</p>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th>Valor</th><th></th></tr>
                            </thead>
                            <tbody>
                                {rows.map((x) => (
                                    <tr key={x.id}>
                                        <td>{dateOnly(x.spent_at)}</td>
                                        <td>{x.expense_categories?.name ?? '—'}</td>
                                        <td>{x.description ?? '—'}</td>
                                        <td>{methodLabel(x.method)}</td>
                                        <td>{brl(x.amount)}</td>
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