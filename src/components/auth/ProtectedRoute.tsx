/**
 * ProtectedRoute Component
 * Auth guard for protected routes
 * Redirects to landing if not authenticated
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/components/auth/AuthProvider'
import LoadingScreen from '../LoadingScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />
  }

  // Redirect to landing if not authenticated
  // Save the attempted location for redirect after login
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  // User is authenticated, render children
  return <>{children}</>
}
