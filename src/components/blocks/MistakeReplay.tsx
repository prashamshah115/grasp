import { useState } from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';
import type { MistakeQuestion } from '../../data/courses';

interface MistakeReplayProps {
  mistakes: MistakeQuestion[];
  onComplete: () => void;
}

export function MistakeReplay({ mistakes, onComplete }: MistakeReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const mistake = mistakes[currentIndex];

  const handleSubmit = () => {
    if (!answer.trim()) return;

    // Simulate improvement detection
    const improved = answer.length > mistake.studentAnswer.length && 
                     answer.toLowerCase().includes('page table');
    
    if (improved) {
      setFeedback('Much better! You included the missing details.');
    } else {
      setFeedback('Still missing: page table update step');
    }

    setTimeout(() => {
      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswer('');
        setFeedback(null);
      } else {
        onComplete();
      }
    }, 2000);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[#6B7280]">Improve your previous errors</p>
        <p className="text-sm text-[#6B7280] mt-1">
          Mistake {currentIndex + 1} of {mistakes.length}
        </p>
      </div>

      {/* Previous Mistake Card */}
      <div className="bg-[#EF4444]/5 rounded-[12px] p-6 border border-[#EF4444]/20 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="mb-2">Previously Missed</h4>
            <p className="text-sm mb-3">{mistake.originalQuestion}</p>
            <div className="bg-white rounded-[12px] p-3 mb-3">
              <p className="text-sm text-[#6B7280]">Your previous answer:</p>
              <p className="text-sm mt-1">{mistake.studentAnswer}</p>
            </div>
            <p className="text-sm text-[#EF4444]">{mistake.feedback}</p>
          </div>
        </div>
      </div>

      {/* Try Again Card */}
      <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
        <h4 className="mb-4">Try again with improvements</h4>
        
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your improved answer..."
          rows={5}
          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] mb-4 resize-none"
          disabled={!!feedback}
        />

        {feedback && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-[12px] mb-4 ${
              feedback.includes('better')
                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                : 'bg-[#FACC15]/10 text-[#92400E]'
            }`}
          >
            {feedback.includes('better') && <TrendingUp className="w-5 h-5" />}
            <span>{feedback}</span>
          </div>
        )}

        {!feedback && (
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Improvement
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-2">
        {mistakes.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              index < currentIndex
                ? 'bg-[#22C55E]'
                : index === currentIndex
                ? 'bg-[#4F46E5]'
                : 'bg-[#E5E7EB]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
