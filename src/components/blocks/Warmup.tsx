import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { WarmupQuestion } from '@/types/legacy';

interface WarmupProps {
  questions: WarmupQuestion[];
  onComplete: () => void;
}

export function Warmup({ questions, onComplete }: WarmupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [answered, setAnswered] = useState<boolean[]>(new Array(questions.length).fill(false));

  const currentQuestion = questions[currentIndex];

  const handleSubmit = () => {
    if (!answer.trim()) return;

    // Simple check - in production this would be more sophisticated
    const isCorrect = answer.toLowerCase().includes(currentQuestion.correctAnswer.toLowerCase().split(' ')[0]);
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    const newAnswered = [...answered];
    newAnswered[currentIndex] = true;
    setAnswered(newAnswered);

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswer('');
        setFeedback(null);
      } else {
        onComplete();
      }
    }, 1500);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[#6B7280]">{currentIndex + 1} of {questions.length} quick recall prompts</p>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-[12px] p-8 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
        <p className="text-xl text-center mb-6">{currentQuestion.question}</p>

        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type your answer..."
          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] mb-4"
          disabled={feedback !== null}
        />

        {feedback && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-[12px] ${
              feedback === 'correct'
                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                : 'bg-[#EF4444]/10 text-[#EF4444]'
            }`}
          >
            {feedback === 'correct' ? (
              <>
                <Check className="w-5 h-5" />
                <span>Correct!</span>
              </>
            ) : (
              <>
                <X className="w-5 h-5" />
                <span>Answer: {currentQuestion.correctAnswer}</span>
              </>
            )}
          </div>
        )}

        {!feedback && (
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        )}
      </div>

      {/* Progress Dots */}
      <div className="flex justify-center gap-2">
        {questions.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              answered[index]
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
