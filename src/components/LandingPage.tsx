interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl tracking-tight">grasp.ai</h1>
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
              onClick={onStart}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-12 py-5 rounded-[14px] text-lg transition-all duration-200"
            >
              Start Final Prep
            </button>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-6">No signup required.</p>
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
