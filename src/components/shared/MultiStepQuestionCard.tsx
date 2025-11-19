import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface QuestionStep {
  id: string;
  prompt: string;
  type: 'text' | 'multiple-choice';
  options?: { id: string; text: string }[];
  placeholder?: string;
}

interface MultiStepQuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  steps: QuestionStep[];
  answers: Record<string, string>;
  onAnswerChange: (stepId: string, answer: string) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  showValidation?: boolean;
  correctAnswers?: Record<string, string>;
}

export function MultiStepQuestionCard({
  questionNumber,
  totalQuestions,
  question,
  steps,
  answers,
  onAnswerChange,
  difficulty,
  showValidation = false,
  correctAnswers
}: MultiStepQuestionCardProps) {
  const difficultyColors = {
    easy: 'bg-[#D1FAE5] text-[#065F46]',
    medium: 'bg-[#FEF3C7] text-[#92400E]',
    hard: 'bg-[#FEE2E2] text-[#991B1B]'
  };

  const isStepCorrect = (stepId: string) => {
    if (!showValidation || !correctAnswers) return null;
    return answers[stepId] === correctAnswers[stepId];
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-[#9CA3AF]">
          Question {questionNumber} of {totalQuestions}
        </div>
        <div className="flex items-center gap-3">
          {showValidation && (
            <div className="text-sm text-[#6B7280]">
              {Object.keys(answers).length} / {steps.length} steps completed
            </div>
          )}
          {difficulty && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[difficulty]}`}>
              {difficulty}
            </div>
          )}
        </div>
      </div>

      {/* Question Text */}
      <h3 className="text-2xl mb-8 leading-relaxed">{question}</h3>

      {/* Steps */}
      <div className="space-y-8">
        {steps.map((step, index) => {
          const isCorrect = isStepCorrect(step.id);
          
          return (
            <div key={step.id} className="relative">
              {/* Step Number */}
              <div className="flex items-start gap-4 mb-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  showValidation && isCorrect === true
                    ? 'bg-[#D1FAE5] text-[#10B981]'
                    : showValidation && isCorrect === false
                    ? 'bg-[#FEE2E2] text-[#EF4444]'
                    : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}>
                  {showValidation && isCorrect !== null ? (
                    isCorrect ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium mb-3">{step.prompt}</div>
                  
                  {/* Input based on type */}
                  {step.type === 'text' ? (
                    <textarea
                      value={answers[step.id] || ''}
                      onChange={(e) => onAnswerChange(step.id, e.target.value)}
                      placeholder={step.placeholder || 'Type your answer here...'}
                      rows={4}
                      className={`w-full px-4 py-3 border-2 rounded-[12px] text-sm resize-none focus:outline-none transition-all ${
                        showValidation && isCorrect === true
                          ? 'border-[#10B981] bg-[#D1FAE5]/30'
                          : showValidation && isCorrect === false
                          ? 'border-[#EF4444] bg-[#FEE2E2]/30'
                          : 'border-[#E5E7EB] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20'
                      }`}
                      disabled={showValidation}
                    />
                  ) : (
                    <div className="space-y-2">
                      {step.options?.map((option) => {
                        const isSelected = answers[step.id] === option.id;
                        
                        let styles = 'bg-white border-[#E5E7EB] hover:border-[#4F46E5]';
                        
                        if (showValidation) {
                          const isCorrectOption = correctAnswers?.[step.id] === option.id;
                          if (isCorrectOption) {
                            styles = 'bg-[#D1FAE5] border-[#10B981] ring-2 ring-[#10B981]';
                          } else if (isSelected && !isCorrectOption) {
                            styles = 'bg-[#FEE2E2] border-[#EF4444] ring-2 ring-[#EF4444]';
                          }
                        } else if (isSelected) {
                          styles = 'bg-[#F5F3FF] border-[#4F46E5] ring-2 ring-[#4F46E5]';
                        }

                        return (
                          <button
                            key={option.id}
                            onClick={() => !showValidation && onAnswerChange(step.id, option.id)}
                            disabled={showValidation}
                            className={`w-full text-left p-4 rounded-[10px] border-2 transition-all ${styles} ${
                              showValidation ? 'cursor-default' : 'cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                showValidation && correctAnswers?.[step.id] === option.id
                                  ? 'border-[#10B981] bg-[#10B981]'
                                  : showValidation && isSelected
                                  ? 'border-[#EF4444] bg-[#EF4444]'
                                  : isSelected
                                  ? 'border-[#4F46E5] bg-[#4F46E5]'
                                  : 'border-[#D1D5DB]'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 text-sm font-medium">{option.text}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Validation message */}
                  {showValidation && isCorrect === false && (
                    <div className="mt-2 text-sm text-[#EF4444] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Review this step - the AI can help explain!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
