import { useState } from 'react';
import { Check } from 'lucide-react';

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  options: QuestionOption[];
  selectedAnswer: string | null;
  onSelectAnswer: (answerId: string) => void;
  showExplanation?: boolean;
  correctAnswer?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export function QuestionCard({
  questionNumber,
  totalQuestions,
  question,
  options,
  selectedAnswer,
  onSelectAnswer,
  showExplanation = false,
  correctAnswer,
  explanation,
  difficulty
}: QuestionCardProps) {
  const difficultyColors = {
    easy: 'bg-[#D1FAE5] text-[#065F46]',
    medium: 'bg-[#FEF3C7] text-[#92400E]',
    hard: 'bg-[#FEE2E2] text-[#991B1B]'
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-[#9CA3AF]">
          Question {questionNumber} of {totalQuestions}
        </div>
        {difficulty && (
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[difficulty]}`}>
            {difficulty}
          </div>
        )}
      </div>

      {/* Question Text */}
      <h3 className="text-2xl mb-8 leading-relaxed">{question}</h3>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = showExplanation && correctAnswer === option.id;
          const isWrong = showExplanation && isSelected && correctAnswer !== option.id;

          let styles = 'bg-white border-[#E5E7EB] hover:border-[#4F46E5]';
          
          if (isCorrect) {
            styles = 'bg-[#D1FAE5] border-[#10B981] ring-2 ring-[#10B981]';
          } else if (isWrong) {
            styles = 'bg-[#FEE2E2] border-[#EF4444] ring-2 ring-[#EF4444]';
          } else if (isSelected && !showExplanation) {
            styles = 'bg-[#F5F3FF] border-[#4F46E5] ring-2 ring-[#4F46E5]';
          }

          return (
            <button
              key={option.id}
              onClick={() => !showExplanation && onSelectAnswer(option.id)}
              disabled={showExplanation}
              className={`w-full text-left p-5 rounded-[12px] border-2 transition-all ${styles} ${
                showExplanation ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Selection Indicator */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isCorrect 
                    ? 'border-[#10B981] bg-[#10B981]'
                    : isWrong
                    ? 'border-[#EF4444] bg-[#EF4444]'
                    : isSelected
                    ? 'border-[#4F46E5] bg-[#4F46E5]'
                    : 'border-[#D1D5DB]'
                }`}>
                  {(isSelected || isCorrect) && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
                
                {/* Option Text */}
                <div className="flex-1 font-medium">{option.text}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation (shown after answer) */}
      {showExplanation && explanation && (
        <div className="mt-6 p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
          <div className="text-sm text-[#6B7280] mb-2 font-medium">Explanation</div>
          <div className="text-[#374151] leading-relaxed">{explanation}</div>
        </div>
      )}
    </div>
  );
}
