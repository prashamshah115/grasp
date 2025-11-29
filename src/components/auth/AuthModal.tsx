import { useState } from 'react'
import { X, Mail, Lock, User, Sparkles } from 'lucide-react'
import { useAuth } from './AuthProvider'

interface AuthPayload {
  mode: 'signin' | 'signup'
  email: string
  password: string
  name?: string
}

interface AuthModalProps {
  isOpen: boolean
  mode: 'signin' | 'signup'
  isSubmitting: boolean
  error: string | null
  onClose: () => void
  onAuthenticate: (payload: AuthPayload) => Promise<void>
  onSwitchMode: (mode: 'signin' | 'signup') => void
}

export function AuthModal({
  isOpen,
  mode,
  isSubmitting,
  error,
  onClose,
  onAuthenticate,
  onSwitchMode,
}: AuthModalProps) {
  const { signInWithGoogle } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })

  if (!isOpen) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onAuthenticate({
      mode,
      email: formData.email,
      password: formData.password,
      name: formData.name,
    })
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleMode = () => {
    onSwitchMode(mode === 'signin' ? 'signup' : 'signin')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[24px] max-w-md w-full shadow-2xl border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] p-8 pb-12">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-[8px] transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-[12px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-medium text-white">novalo.io</h1>
          </div>

          <h2 className="text-3xl text-white mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Get started'}
          </h2>
          <p className="text-white/80">
            {mode === 'signin'
              ? 'Sign in to continue your learning journey'
              : 'Create your account to ace your finals'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#E5E7EB] hover:border-[#D1D5DB] text-[#374151] py-3 rounded-[12px] font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-[#6B7280]">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#374151] mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-12 pr-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                    required={mode === 'signup'}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#374151] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="you@university.edu"
                  className="w-full pl-12 pr-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#374151] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-[#6B7280]">Must be at least 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 rounded-[12px] font-medium transition-all mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            {error && (
              <p className="text-sm text-[#EF4444] text-center">
                {error}
              </p>
            )}
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button onClick={toggleMode} className="text-sm text-[#6B7280] hover:text-[#4F46E5] transition-colors">
              {mode === 'signin' ? (
                <>
                  Don't have an account? <span className="font-medium text-[#4F46E5]">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account? <span className="font-medium text-[#4F46E5]">Sign in</span>
                </>
              )}
            </button>
          </div>

          {/* Demo Notice */}
          <div className="mt-6 p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px]">
            <p className="text-xs text-[#6B7280] text-center">📚 Demo Mode: Use any email to try the app</p>
          </div>
        </div>
      </div>
    </div>
  )
}

