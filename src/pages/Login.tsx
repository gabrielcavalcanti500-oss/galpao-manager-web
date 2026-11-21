import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg('Cadastro feito! Confirme seu e-mail para entrar.')
    }
    setBusy(false)
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="brand"><span className="logo">G</span><strong>Galpão Manager</strong></div>
      <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      {mode === 'signup' && (
        <input placeholder="Seu nome" value={name}
          onChange={(e) => setName(e.target.value)} required />
      )}
      <input type="email" placeholder="E-mail" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Senha (mín. 6 caracteres)" value={password}
        onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      {msg && <div className="msg">{msg}</div>}
      <button disabled={busy}>{mode === 'login' ? 'Entrar' : 'Cadastrar'}</button>
      <button type="button" className="link"
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>
        {mode === 'login' ? 'Não tenho conta' : 'Já tenho conta'}
      </button>
    </form>
  )
}