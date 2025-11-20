import { useState } from 'react'
import { X, Mail, Lock, User, Sparkles } from 'lucide-react'

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
            <h1 className="text-2xl font-medium text-white">grasp.ai</h1>
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

