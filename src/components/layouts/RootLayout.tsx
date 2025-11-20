/**
 * RootLayout Component
 * Top-level layout with navigation and chat overlay
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import LoadingScreen from '../LoadingScreen'
import { useAuth } from '@/components/auth/AuthProvider'

export default function RootLayout() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (user && location.pathname === '/') {
      navigate('/courses', { replace: true })
    }
  }, [user, isLoading, location.pathname, navigate])

  useEffect(() => {
    if (isLoading) return
    if (!user && location.pathname !== '/') {
      // Let ProtectedRoute handle course routes, but ensure we don't leave unauthenticated users stranded
      navigate('/', { replace: true })
    }
  }, [user, isLoading, location.pathname, navigate])

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
