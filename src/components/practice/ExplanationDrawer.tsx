import { X, Lightbulb } from 'lucide-react';

interface ExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

export function ExplanationDrawer({
  isOpen,
  onClose,
  explanation,
  correctAnswer,
  userAnswer,
  isCorrect
}: ExplanationDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] rounded-t-[24px] z-50 max-h-[70vh] overflow-y-auto shadow-2xl">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center ${
                isCorrect ? 'bg-[#D1FAE5]' : 'bg-[#FEF3C7]'
              }`}>
                <Lightbulb className={`w-6 h-6 ${
                  isCorrect ? 'text-[#10B981]' : 'text-[#F59E0B]'
                }`} />
              </div>
              <div>
                <h3 className="text-2xl font-medium mb-1">
                  {isCorrect ? 'Correct!' : 'Not quite'}
                </h3>
                <p className="text-[#6B7280]">
                  {isCorrect 
                    ? 'Great job! Here\'s why this answer is right'
                    : 'Let\'s review why this is the better answer'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F9FAFB] rounded-[8px] transition-colors"
            >
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Answer Comparison */}
          {!isCorrect && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[#FEE2E2] border border-[#FEE2E2] rounded-[12px]">
                <div className="text-xs text-[#991B1B] mb-2 font-medium">Your Answer</div>
                <div className="text-[#DC2626]">{userAnswer}</div>
              </div>
              <div className="p-4 bg-[#D1FAE5] border border-[#D1FAE5] rounded-[12px]">
                <div className="text-xs text-[#065F46] mb-2 font-medium">Correct Answer</div>
                <div className="text-[#059669]">{correctAnswer}</div>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
            <div className="text-sm text-[#6B7280] mb-3 font-medium">Explanation</div>
            <div className="text-[#374151] leading-relaxed whitespace-pre-wrap">
              {explanation}
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 py-4 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}
