import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'

export function useMyProfile() {
    const { session } = useAuth()
    const userId = session?.user.id
    return useQuery({
        queryKey: ['profile', userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId!)
                .maybeSingle()
            return data as { full_name: string | null } | null
        },
    })
}

export function displayName(
    fullName: string | null | undefined,
    email: string | null | undefined,
) {
    const raw = (fullName ?? email ?? '').trim()
    const base = raw.includes('@') ? raw.split('@')[0] : raw
    return base || 'Você'
}

export function firstName(name: string) {
    const first = name.split(/[\s._-]+/)[0] || name
    return first.charAt(0).toUpperCase() + first.slice(1)
}