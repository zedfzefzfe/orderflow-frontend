import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || ''

interface AuthUser {
  id: string
  email: string
}

interface SignupFullParams {
  boutiqueName: string
  email: string
  password: string
  whatsappNumber?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  signupFull: (params: SignupFullParams) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  // Full signup: creates Supabase auth user + calls backend to set boutique name & phone
  const signupFull = async ({ boutiqueName, email, password, whatsappNumber }: SignupFullParams) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    // If session is immediately available (email confirmation disabled), call backend
    const token = data.session?.access_token
    if (token) {
      await fetch(`${API_URL}/api/business/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ boutiqueName, whatsappPhoneNumber: whatsappNumber }),
      })
    }
    // If no session (email confirmation required), backend will auto-provision on first login
    // and the boutique name can be updated from settings later
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, signupFull, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
