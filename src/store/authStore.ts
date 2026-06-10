import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { auth } from '../lib/database'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: User | null, session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      loading: false,
      initialized: false,

      signIn: async (email, password) => {
        set({ loading: true })
        try {
          const data = await auth.signIn(email, password)
          set({ user: data.user, session: data.session })
          if (data.user) await get().fetchProfile(data.user.id)
        } finally {
          set({ loading: false })
        }
      },

      signOut: async () => {
        await auth.signOut()
        set({ user: null, session: null, profile: null })
      },

      setUser: (user, session) => {
        set({ user, session, initialized: true })
        if (user) get().fetchProfile(user.id)
      },

      fetchProfile: async (userId) => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          set({ profile: data ?? null, initialized: true })
        } catch {
          // Profile may not exist yet (new user) — still mark as initialized
          set({ initialized: true })
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, session: state.session, profile: state.profile }),
    }
  )
)
