import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Company = { id: string; name: string }

type AuthState = {
  session: Session | null
  company: Company | null
  loading: boolean
  refreshCompany: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refreshCompany = useCallback(async () => {
    if (!userId) {
      setCompany(null)
      setCompanyLoading(false)
      return
    }
    setCompanyLoading(true)
    const { data } = await supabase
      .from('company_members')
      .select('companies(id, name)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    const row = data as unknown as { companies: Company } | null
    setCompany(row?.companies ?? null)
    setCompanyLoading(false)
  }, [userId])

  useEffect(() => {
    if (sessionReady) refreshCompany()
  }, [sessionReady, refreshCompany])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session, company, refreshCompany, signOut,
        loading: !sessionReady || companyLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro do AuthProvider')
  return ctx
}