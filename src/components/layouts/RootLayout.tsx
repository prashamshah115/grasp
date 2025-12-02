/**
 * RootLayout Component
 * Top-level layout with navigation and chat overlay
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import LoadingScreen from '../LoadingScreen'
import { useAuth } from '@/components/auth/AuthProvider'
import { AIAssistant } from '@/components/shared/AIAssistant'

export default function RootLayout() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Don't navigate while loading auth state
    if (isLoading) return
    
    try {
      // Only auto-redirect authenticated users from landing page
      if (user && location.pathname === '/') {
        navigate('/courses', { replace: true })
      }
    } catch (error) {
      console.error('[RootLayout] Navigation error:', error)
      // Don't crash - let the route handle itself
    }
  }, [user, isLoading, location.pathname, navigate])

  // Don't show AI Assistant on landing page
  const showAIAssistant = user && location.pathname !== '/'

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
      
      {/* Global AI Assistant - Available on all authenticated pages */}
      {showAIAssistant && (
        <AIAssistant mode="general" />
      )}
    </div>
  )
}
