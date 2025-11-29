import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthModal } from './AuthModal'
import { EmailConfirmationScreen } from './EmailConfirmationScreen'
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
  pendingConfirmation: boolean
  pendingEmail: string | null
  openAuthModal: (mode?: 'signin' | 'signup') => void
  closeAuthModal: () => void
  signOut: () => Promise<void>
  resendConfirmation: () => Promise<void>
  signInWithGoogle: () => Promise<void>
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
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setModalMode(mode)
    setModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => setModalOpen(false), [])

  const mapSupabaseUser = (
    sessionUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>['user'] | null,
  ): AuthUser | null => {
    if (!sessionUser) return null
    // Extract name from Google OAuth metadata or fallback to email
    const name = 
      (sessionUser.user_metadata?.full_name as string) ??
      (sessionUser.user_metadata?.name as string) ??
      sessionUser.email ??
      ''
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      name: name || null,
    }
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    setIsSubmitting(true)
    try {
      // Get the current path to redirect back to the same page after auth
      const redirectPath = window.location.pathname === '/' ? '/courses' : window.location.pathname
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
      // Note: User will be redirected to Google, then Supabase callback, then back to app
      // The redirectTo ensures they land on your domain, not Supabase's
    } catch (error) {
      console.error('Google OAuth error', error)
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed')
      setIsSubmitting(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        
        const sessionUser = data.session?.user
        const mappedUser = mapSupabaseUser(sessionUser)
        setUser(mappedUser)
        
        // Check if user exists but no session (email confirmation pending)
        if (sessionUser && !data.session) {
          setPendingConfirmation(true)
          setPendingEmail(sessionUser.email || null)
        } else {
          setPendingConfirmation(false)
          setPendingEmail(null)
        }
      } catch (error) {
        console.error('Failed to load session', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      const sessionUser = session?.user
      const mappedUser = mapSupabaseUser(sessionUser)
      setUser(mappedUser)
      
      // Handle email confirmation
      if (event === 'SIGNED_UP' && sessionUser && !session) {
        setPendingConfirmation(true)
        setPendingEmail(sessionUser.email || null)
      } else if (event === 'SIGNED_IN' && session) {
        // Email confirmed, clear pending state
        setPendingConfirmation(false)
        setPendingEmail(null)
      }
      
      if (!session) {
        setAuthError(null)
        setPendingConfirmation(false)
        setPendingEmail(null)
      }
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
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name },
              emailRedirectTo: `${window.location.origin}`,
            },
          })
          if (error) throw error
          
          // Check if email confirmation is required
          if (data.user && !data.session) {
            setPendingConfirmation(true)
            setPendingEmail(email)
            setModalOpen(false)
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          setModalOpen(false)
        }
      } catch (error) {
        console.error('Auth error', error)
        setAuthError(error instanceof Error ? error.message : 'Authentication failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  const resendConfirmation = useCallback(async () => {
    if (!pendingEmail) return
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: {
        emailRedirectTo: `${window.location.origin}`,
      },
    })
    
    if (error) {
      console.error('Failed to resend confirmation:', error)
      throw error
    }
  }, [pendingEmail])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      pendingConfirmation,
      pendingEmail,
      openAuthModal,
      closeAuthModal,
      signOut,
      resendConfirmation,
      signInWithGoogle,
    }),
    [user, isLoading, pendingConfirmation, pendingEmail, openAuthModal, closeAuthModal, signOut, resendConfirmation, signInWithGoogle],
  )

  // Show email confirmation screen if pending
  if (pendingConfirmation && pendingEmail) {
    return (
      <AuthContext.Provider value={value}>
        <EmailConfirmationScreen
          email={pendingEmail}
          onResend={resendConfirmation}
        />
      </AuthContext.Provider>
    )
  }

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

