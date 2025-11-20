import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthModal } from './AuthModal'
import { supabase } from '@/lib/supabase'

export interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  openAuthModal: (mode?: 'signin' | 'signup') => void
  closeAuthModal: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin')

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setModalMode(mode)
    setModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => setModalOpen(false), [])

  const mapSupabaseUser = (
    sessionUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>['user'] | null,
  ): AuthUser | null => {
    if (!sessionUser) return null
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      name: (sessionUser.user_metadata?.full_name as string) ?? sessionUser.email ?? '',
    }
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(mapSupabaseUser(data.session?.user))
      } catch (error) {
        console.error('Failed to load session', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(mapSupabaseUser(session?.user))
      if (!session) setAuthError(null)
    })

    return () => {
      mounted = false
      subscription?.subscription.unsubscribe()
    }
  }, [])

  const handleAuthenticate = useCallback(
    async ({ mode, email, password, name }: { mode: 'signin' | 'signup'; email: string; password: string; name?: string }) => {
      setAuthError(null)
      setIsSubmitting(true)
      try {
        if (mode === 'signup') {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name },
              emailRedirectTo: window.location.origin,
            },
          })
          if (error) throw error
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
        }
        setModalOpen(false)
      } catch (error) {
        console.error('Auth error', error)
        setAuthError(error instanceof Error ? error.message : 'Authentication failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      openAuthModal,
      closeAuthModal,
      signOut,
    }),
    [user, isLoading, openAuthModal, closeAuthModal, signOut],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={modalOpen}
        mode={modalMode}
        isSubmitting={isSubmitting}
        error={authError}
        onClose={closeAuthModal}
        onAuthenticate={handleAuthenticate}
        onSwitchMode={setModalMode}
      />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

