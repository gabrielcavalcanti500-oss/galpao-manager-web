import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Onboarding() {
  const { refreshCompany, signOut } = useAuth()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const { error } = await supabase.rpc('create_company', { p_name: name })
    if (error) {
      setMsg(error.message)
      setBusy(false)
      return
    }
    await refreshCompany()
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Cadastre sua empresa</h2>
      <input placeholder="Nome do ferro-velho / depósito" value={name}
        onChange={(e) => setName(e.target.value)} required />
      {msg && <div className="msg">{msg}</div>}
      <button disabled={busy}>Criar empresa</button>
      <button type="button" className="link" onClick={signOut}>Sair</button>
    </form>
  )
}