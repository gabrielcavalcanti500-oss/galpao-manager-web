import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Result = PromiseLike<{ error: { message: string } | null }>

export default function Onboarding() {
  const { refreshCompany, signOut } = useAuth()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [which, setWhich] = useState<'create' | 'join' | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(kind: 'create' | 'join', fn: () => Result) {
    setBusy(true)
    setMsg('')
    setWhich(kind)
    const { error } = await fn()
    if (error) setMsg(error.message)
    else await refreshCompany()
    setBusy(false)
  }

  function createCompany(e: FormEvent) {
    e.preventDefault()
    run('create', () => supabase.rpc('create_company', { p_name: name }))
  }

  function joinCompany(e: FormEvent) {
    e.preventDefault()
    run('join', () => supabase.rpc('join_company', { p_code: code }))
  }

  return (
    <>
      <form className="card" onSubmit={createCompany}>
        <h2>Cadastre sua empresa</h2>
        <input placeholder="Nome do ferro-velho / depósito" value={name}
          onChange={(e) => setName(e.target.value)} required />
        {which === 'create' && msg && <div className="msg">{msg}</div>}
        <button disabled={busy}>Criar empresa</button>
      </form>

      <form className="card" onSubmit={joinCompany}>
        <h2>Recebeu um código de convite?</h2>
        <input placeholder="Código de convite" value={code}
          onChange={(e) => setCode(e.target.value)} required />
        {which === 'join' && msg && <div className="msg">{msg}</div>}
        <button disabled={busy}>Entrar na empresa</button>
        <button type="button" className="link" onClick={signOut}>Sair</button>
      </form>
    </>
  )
}