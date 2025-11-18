import { CheckCircle, TrendingUp } from 'lucide-react';

interface WorkoutCompleteProps {
  onViewCheatsheet: () => void;
  onReturnHome: () => void;
  masteryGain: number;
}

export function WorkoutComplete({ onViewCheatsheet, onReturnHome, masteryGain }: WorkoutCompleteProps) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white rounded-[12px] p-8 border border-[#E5E7EB] text-center" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
          <div className="w-20 h-20 rounded-full bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[#22C55E]" />
          </div>

          <h2 className="text-2xl mb-2">Workout Complete!</h2>
          <p className="text-[#6B7280] mb-8">
            Great session. You're getting stronger.
          </p>

          {/* Stats */}
          <div className="bg-[#F9FAFB] rounded-[12px] p-6 mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#22C55E]" />
              <span className="text-3xl text-[#22C55E]">+{masteryGain}%</span>
            </div>
            <p className="text-sm text-[#6B7280]">Mastery Gained</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onViewCheatsheet}
              className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors"
            >
              View Updated Cheatsheet
            </button>
            <button
              onClick={onReturnHome}
              className="w-full bg-white border border-[#E5E7EB] hover:border-[#4F46E5] text-[#111827] py-3 px-6 rounded-[12px] transition-colors"
            >
              Return to Course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
