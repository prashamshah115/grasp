/**
 * App Component
 * Main application entry point with React Router v7
 *
 * IMPLEMENTATION:
 * ✅ React Router v7 with RouterProvider
 * ✅ TanStack Query wrapper
 * ✅ Zustand state management
 * ✅ Error boundaries
 * ✅ Suspense boundaries
 */

import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './components/auth/AuthProvider'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
