/**
 * RootLayout Component
 * Top-level layout with navigation and chat overlay
 */

import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import LoadingScreen from '../LoadingScreen'

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
