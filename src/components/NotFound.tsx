/**
 * NotFound Component
 * 404 page
 */

import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'
import { Button } from './ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Search className="h-12 w-12 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-text-secondary">
            Page Not Found
          </h2>
          <p className="text-text-tertiary">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link to="/">
          <Button variant="default" className="w-full">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
