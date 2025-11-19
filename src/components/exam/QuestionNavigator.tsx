import { Flag, Check } from 'lucide-react';

interface Question {
  id: string;
  number: number;
  isAnswered: boolean;
  isFlagged: boolean;
}

interface QuestionNavigatorProps {
  questions: Question[];
  currentQuestionNumber: number;
  onNavigateToQuestion: (questionNumber: number) => void;
}

export function QuestionNavigator({
  questions,
  currentQuestionNumber,
  onNavigateToQuestion
}: QuestionNavigatorProps) {
  const answeredCount = questions.filter(q => q.isAnswered).length;
  const flaggedCount = questions.filter(q => q.isFlagged).length;

  return (
    <div className="w-72 border-l border-[#E5E7EB] bg-[#FAFAFA] h-full overflow-y-auto">
      <div className="p-6">
        {/* Stats */}
        <div className="mb-6">
          <h3 className="font-medium mb-4">Questions</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-[10px] border border-[#E5E7EB]">
              <div className="text-2xl font-medium mb-1">{answeredCount}</div>
              <div className="text-xs text-[#6B7280]">Answered</div>
            </div>
            <div className="p-3 bg-white rounded-[10px] border border-[#E5E7EB]">
              <div className="text-2xl font-medium mb-1 text-[#F59E0B]">{flaggedCount}</div>
              <div className="text-xs text-[#6B7280]">Flagged</div>
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-5 gap-2">
          {questions.map((question) => {
            const isCurrent = currentQuestionNumber === question.number;
            
            let styles = 'bg-white border-[#E5E7EB]';
            
            if (isCurrent) {
              styles = 'bg-[#4F46E5] border-[#4F46E5] text-white';
            } else if (question.isFlagged) {
              styles = 'bg-[#FEF3C7] border-[#F59E0B]';
            } else if (question.isAnswered) {
              styles = 'bg-[#D1FAE5] border-[#10B981]';
            }

            return (
              <button
                key={question.id}
                onClick={() => onNavigateToQuestion(question.number)}
                className={`relative w-full aspect-square rounded-[8px] border-2 font-medium transition-all hover:scale-105 ${styles}`}
              >
                <div className="flex items-center justify-center h-full">
                  {question.number}
                </div>
                
                {/* Indicators */}
                {question.isFlagged && !isCurrent && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#F59E0B] rounded-full flex items-center justify-center">
                    <Flag className="w-2.5 h-2.5 text-white" fill="white" />
                  </div>
                )}
                {question.isAnswered && !isCurrent && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#10B981] rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 space-y-2 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#4F46E5]"></div>
            <span>Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#D1FAE5] border border-[#10B981]"></div>
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#FEF3C7] border border-[#F59E0B]"></div>
            <span>Flagged</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-white border border-[#E5E7EB]"></div>
            <span>Unanswered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
