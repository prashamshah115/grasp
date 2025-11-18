import { useState } from 'react';
import type { Concept } from '../../data/courses';

interface KillZoneProps {
  concepts: Concept[];
  onComplete: () => void;
}

export function KillZone({ concepts, onComplete }: KillZoneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const weakConcepts = concepts.filter(c => c.masteryLevel < 70).slice(0, 3);
  const currentConcept = weakConcepts[currentIndex];

  const handleSubmit = () => {
    if (!answer.trim()) return;

    // Simulate AI feedback
    const missingKeywords = ['hardware', 'trap', 'restart'];
    const hasMissing = missingKeywords.some(
      keyword => !answer.toLowerCase().includes(keyword)
    );

    if (hasMissing) {
      setFeedback('Good start! Missing: mention of hardware trap and instruction restart.');
      setShowFollowUp(true);
    } else {
      setFeedback('Excellent! Moving to next concept.');
      setTimeout(() => {
        if (currentIndex < weakConcepts.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setAnswer('');
          setFeedback(null);
          setShowFollowUp(false);
        } else {
          onComplete();
        }
      }, 2000);
    }
  };

  const handleFollowUp = () => {
    setTimeout(() => {
      if (currentIndex < weakConcepts.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswer('');
        setFeedback(null);
        setShowFollowUp(false);
      } else {
        onComplete();
      }
    }, 1500);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[#6B7280]">Focus on your weakest concepts</p>
        <p className="text-sm text-[#6B7280] mt-1">
          Concept {currentIndex + 1} of {weakConcepts.length}
        </p>
      </div>

      {/* Concept Card */}
      <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
        <h3 className="text-xl mb-2">{currentConcept.title}</h3>
        <p className="text-[#6B7280] text-sm">{currentConcept.definition}</p>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
        <p className="mb-4">
          {!showFollowUp
            ? `Explain what triggers a ${currentConcept.title.toLowerCase()}.`
            : "Why can't the OS handle this without hardware support?"}
        </p>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your explanation..."
          rows={4}
          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] mb-4 resize-none"
          disabled={!!feedback && !showFollowUp}
        />

        {feedback && (
          <div
            className={`px-4 py-3 rounded-[12px] mb-4 ${
              showFollowUp
                ? 'bg-[#FACC15]/10 text-[#92400E]'
                : 'bg-[#22C55E]/10 text-[#22C55E]'
            }`}
          >
            {feedback}
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

        {showFollowUp && (
          <button
            onClick={handleFollowUp}
            className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors"
          >
            Submit Follow-up
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-2">
        {weakConcepts.map((_, index) => (
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
