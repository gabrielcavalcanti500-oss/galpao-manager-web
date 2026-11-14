import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateTime } from '../lib/format'

type Role = 'owner' | 'admin' | 'operator'
type Member = {
  user_id: string
  role: Role
  created_at: string
  profiles: { full_name: string | null } | null
}
type Invite = { id: string; code: string; role: 'admin' | 'operator'; expires_at: string }

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  operator: 'Operador',
}

export default function Team() {
  const { company, session } = useAuth()
  const companyId = company!.id
  const isOwner = company!.role === 'owner'
  const myId = session!.user.id
  const qc = useQueryClient()
  const [role, setRole] = useState<'operator' | 'admin'>('operator')
  const [msg, setMsg] = useState('')

  const { data: members = [] } = useQuery({
    queryKey: ['team', 'members', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_members')
        .select('user_id, role, created_at, profiles(full_name)')
        .eq('company_id', companyId)
        .order('created_at')
      if (error) throw error
      return data as unknown as Member[]
    },
  })

  const { data: invites = [] } = useQuery({
    queryKey: ['team', 'invites', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_invites')
        .select('id, code, role, expires_at')
        .eq('company_id', companyId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Invite[]
    },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['team'] })
  const onError = (e: unknown) => setMsg((e as { message?: string }).message ?? 'Erro')

  const createInvite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_invite', {
        p_company_id: companyId,
        p_role: role,
      })
      if (error) throw error
    },
    onSuccess: () => { setMsg(''); refresh() },
    onError,
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_invites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError,
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_member', {
        p_company_id: companyId,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => { setMsg(''); refresh() },
    onError,
  })

  const canRemove = (m: Member) =>
    m.role !== 'owner' && m.user_id !== myId && (m.role !== 'admin' || isOwner)

  function askRemove(m: Member) {
    const nome = m.profiles?.full_name ?? 'esta pessoa'
    if (window.confirm(`Remover ${nome} da empresa? Ela perde o acesso, mas o histórico dela é mantido.`)) {
      removeMember.mutate(m.user_id)
    }
  }

  const whatsappLink = (code: string) => {
    const text =
      `Você foi convidado para o ${company!.name} no Galpão Manager.\n` +
      `1) Acesse ${window.location.origin} e crie sua conta.\n` +
      `2) Na primeira tela, digite o código de convite: ${code}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  return (
    <>
      <div className="panel">
        <h2>Convidar pessoa</h2>
        <p>Gere um código e envie por WhatsApp. Cada código serve para uma pessoa e vale por 7 dias.</p>
        <div className="form-grid">
          <select value={role} onChange={(e) => setRole(e.target.value as 'operator' | 'admin')}>
            <option value="operator">Operador (compras e estoque)</option>
            {isOwner && <option value="admin">Administrador</option>}
          </select>
          <button className="btn" disabled={createInvite.isPending}
            onClick={() => createInvite.mutate()}>
            Gerar código
          </button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </div>

      {invites.length > 0 && (
        <div className="panel">
          <h3>Convites pendentes</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Papel</th><th>Vale até</th><th></th></tr></thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.code}</strong></td>
                    <td>{ROLE_LABEL[i.role]}</td>
                    <td>{dateTime(i.expires_at)}</td>
                    <td>
                      <div className="actions">
                        <a className="btn secondary small" href={whatsappLink(i.code)}
                          target="_blank" rel="noreferrer">WhatsApp</a>
                        <button className="btn danger small" onClick={() => revoke.mutate(i.id)}>
                          Revogar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Membros</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Papel</th><th>Entrou em</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.profiles?.full_name ?? '—'}{m.user_id === myId ? ' (você)' : ''}</td>
                  <td>{ROLE_LABEL[m.role]}</td>
                  <td>{dateTime(m.created_at)}</td>
                  <td>
                    {canRemove(m) && (
                      <button className="btn danger small" onClick={() => askRemove(m)}>Remover</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}