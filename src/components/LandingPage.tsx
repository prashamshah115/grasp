import { useAuth } from '@/components/auth/AuthProvider'

export function LandingPage() {
  const { openAuthModal } = useAuth()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl tracking-tight">grasp.ai</h1>
          <button
            onClick={() => openAuthModal('signin')}
            className="text-sm font-medium text-[#4F46E5] hover:text-[#4338CA] transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Center Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl w-full text-center">
          <h1 className="text-6xl md:text-7xl mb-6 tracking-tight">
            Ace your finals.
          </h1>
          <p className="text-xl text-[#6B7280] mb-16 leading-relaxed">
            Master your entire quarter in one place.<br/>
            Fast, adaptive, exam-focused.
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => openAuthModal('signup')}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-12 py-5 rounded-[14px] text-lg transition-all duration-200"
            >
              Get Started
            </button>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-6">Sign up to build your finals game plan.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-sm text-[#9CA3AF] border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto">
          Tailored specifically for UCSD students
        </div>
      </footer>
    </div>
  );
}
