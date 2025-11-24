/**
 * Auth Callback Handler
 * Handles Supabase email confirmation redirects
 * Route: /auth/callback
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          navigate('/courses', { replace: true })
          return
        }

        if (data.session) {
          // Email confirmed successfully, redirect to courses
          navigate('/courses', { replace: true })
        } else {
          // No session, redirect to sign in
          navigate('/', { replace: true })
        }
      } catch (error) {
        console.error('Failed to handle auth callback:', error)
        navigate('/courses', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-text-secondary">Confirming your email...</p>
      </div>
    </div>
  )
}

