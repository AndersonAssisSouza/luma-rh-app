import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  tenant: null,
  loading: true,
  error: null,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await get().loadProfile(session.user)
    else set({ loading: false })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await get().loadProfile(session.user)
      else set({ user: null, profile: null, tenant: null, loading: false })
    })
  },

  loadProfile: async (user) => {
    set({ user, loading: true })
    try {
      const { data: profile, error: ep } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (ep) throw ep

      let tenant = null
      if (profile.tenant_id) {
        const { data: t } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single()
        tenant = t
      }

      set({ user, profile, tenant, loading: false, error: null })
    } catch (e) {
      set({ loading: false, error: e.message })
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) set({ loading: false, error: error.message })
  },

  signInMagicLink: async (email) => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) set({ loading: false, error: error.message })
    else set({ loading: false })
    return !error
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, tenant: null })
  },

  // helpers
  isManagerGlobal: () => get().profile?.role === 'manager_global',
  isMaster: () => ['manager_global', 'master'].includes(get().profile?.role),
  isRH: () => ['manager_global', 'master', 'rh'].includes(get().profile?.role),
  isGestor: () => ['manager_global', 'master', 'rh', 'gestor'].includes(get().profile?.role),
}))
