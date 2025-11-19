import { AlertTriangle, CheckCircle } from 'lucide-react';

interface SubmitExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalQuestions: number;
  answeredQuestions: number;
  flaggedQuestions: number;
}

export function SubmitExamModal({
  isOpen,
  onClose,
  onConfirm,
  totalQuestions,
  answeredQuestions,
  flaggedQuestions
}: SubmitExamModalProps) {
  if (!isOpen) return null;

  const unansweredCount = totalQuestions - answeredQuestions;
  const hasUnanswered = unansweredCount > 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-[20px] max-w-md w-full p-8">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-[16px] flex items-center justify-center mx-auto mb-4 ${
            hasUnanswered ? 'bg-[#FEF3C7]' : 'bg-[#D1FAE5]'
          }`}>
            {hasUnanswered ? (
              <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
            ) : (
              <CheckCircle className="w-8 h-8 text-[#10B981]" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-3xl text-center mb-3">
            {hasUnanswered ? 'Submit anyway?' : 'Submit exam?'}
          </h2>
          
          {/* Message */}
          <p className="text-center text-[#6B7280] mb-6">
            {hasUnanswered
              ? `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. You can still submit, but consider reviewing them first.`
              : 'You\'ve answered all questions. Ready to see your results?'}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 bg-[#F9FAFB] rounded-[12px] text-center">
              <div className="text-2xl font-medium mb-1">{totalQuestions}</div>
              <div className="text-xs text-[#6B7280]">Total</div>
            </div>
            <div className="p-4 bg-[#D1FAE5] rounded-[12px] text-center">
              <div className="text-2xl font-medium text-[#10B981] mb-1">{answeredQuestions}</div>
              <div className="text-xs text-[#6B7280]">Answered</div>
            </div>
            <div className="p-4 bg-[#FEF3C7] rounded-[12px] text-center">
              <div className="text-2xl font-medium text-[#F59E0B] mb-1">{flaggedQuestions}</div>
              <div className="text-xs text-[#6B7280]">Flagged</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-[#E5E7EB] rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              Review
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors"
            >
              Submit Exam
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
