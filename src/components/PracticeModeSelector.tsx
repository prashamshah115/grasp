import { ArrowLeft, Zap, Target, FileText, RotateCcw, Layers } from 'lucide-react';

interface PracticeModeSelectorProps {
  onSelectMode: (mode: 'quick-recall' | 'weak-spots' | 'exam-problems' | 'mistake-replay' | 'compression') => void;
  onBack: () => void;
}

export function PracticeModeSelector({ onSelectMode, onBack }: PracticeModeSelectorProps) {
  const modes = [
    {
      id: 'quick-recall' as const,
      icon: Zap,
      title: 'Quick Recall',
      desc: 'Instant warmup — rapid-fire questions to activate your knowledge',
      time: '5-10 min'
    },
    {
      id: 'weak-spots' as const,
      icon: Target,
      title: 'Weak Spots',
      desc: 'Adaptive practice on your lowest-scoring concepts',
      time: '15-20 min'
    },
    {
      id: 'exam-problems' as const,
      icon: FileText,
      title: 'Exam Problems',
      desc: 'Real finals and midterm questions from past years',
      time: '20-30 min'
    },
    {
      id: 'mistake-replay' as const,
      icon: RotateCcw,
      title: 'Mistake Replay',
      desc: 'Review and fix your recent errors until mastered',
      time: '10-15 min'
    },
    {
      id: 'compression' as const,
      icon: Layers,
      title: 'Compression',
      desc: 'Build your finals cheatsheet through active recall',
      time: '15-25 min'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl tracking-tight">novalo.io</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-16">
          <h1 className="text-5xl mb-4 tracking-tight">
            Choose Your Practice Mode
          </h1>
          <p className="text-lg text-[#6B7280]">
            Enter any mode, anytime — non-linear by design
          </p>
        </div>

        {/* Mode Cards */}
        <div className="space-y-4">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className="w-full bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] hover:shadow-sm transition-all duration-200 flex items-start gap-6"
            >
              <div className="w-14 h-14 rounded-[12px] bg-[#F5F3FF] flex items-center justify-center flex-shrink-0">
                <mode.icon className="w-7 h-7 text-[#4F46E5]" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl">{mode.title}</h3>
                  <span className="text-sm text-[#6B7280] bg-[#F9FAFB] px-3 py-1 rounded-full">
                    {mode.time}
                  </span>
                </div>
                <p className="text-[#6B7280]">{mode.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
