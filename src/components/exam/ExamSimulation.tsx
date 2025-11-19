import { useState } from 'react';
import { Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { QuestionCard } from '../shared/QuestionCard';
import { ExamTimer } from './ExamTimer';
import { QuestionNavigator } from './QuestionNavigator';
import { SubmitExamModal } from './SubmitExamModal';

interface ExamQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ExamSimulationProps {
  examTitle: string;
  durationMinutes: number;
  questions: ExamQuestion[];
  onComplete: (score: number) => void;
  onExit: () => void;
}

export function ExamSimulation({
  examTitle,
  durationMinutes,
  questions,
  onComplete,
  onExit
}: ExamSimulationProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  
  const questionsWithStatus = questions.map((q, index) => ({
    id: q.id,
    number: index + 1,
    isAnswered: !!answers[q.id],
    isFlagged: flagged.has(q.id)
  }));

  const handleSelectAnswer = (answerId: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: answerId });
  };

  const handleToggleFlag = () => {
    const newFlagged = new Set(flagged);
    if (newFlagged.has(currentQuestion.id)) {
      newFlagged.delete(currentQuestion.id);
    } else {
      newFlagged.add(currentQuestion.id);
    }
    setFlagged(newFlagged);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNavigateToQuestion = (questionNumber: number) => {
    setCurrentQuestionIndex(questionNumber - 1);
  };

  const handleTimeUp = () => {
    handleSubmitExam();
  };

  const handleSubmitExam = () => {
    // Calculate score
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    const score = (correct / questions.length) * 100;
    onComplete(score);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-1">Exam Simulation</div>
              <h1 className="text-2xl font-medium">{examTitle}</h1>
            </div>
            <div className="flex items-center gap-4">
              <ExamTimer
                durationMinutes={durationMinutes}
                onTimeUp={handleTimeUp}
              />
              <button
                onClick={onExit}
                className="px-4 py-2 text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Question Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Flag Button */}
            <div className="flex justify-end mb-6">
              <button
                onClick={handleToggleFlag}
                className={`flex items-center gap-2 px-4 py-2 rounded-[10px] border transition-all ${
                  flagged.has(currentQuestion.id)
                    ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#F59E0B]'
                    : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#F59E0B]'
                }`}
              >
                <Flag
                  className="w-4 h-4"
                  fill={flagged.has(currentQuestion.id) ? 'currentColor' : 'none'}
                />
                <span className="text-sm font-medium">
                  {flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag for review'}
                </span>
              </button>
            </div>

            {/* Question Card */}
            <QuestionCard
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              question={currentQuestion.question}
              options={currentQuestion.options}
              selectedAnswer={answers[currentQuestion.id] || null}
              onSelectAnswer={handleSelectAnswer}
              difficulty={currentQuestion.difficulty}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-[12px] border border-[#E5E7EB] font-medium hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-8 py-3 bg-[#10B981] text-white rounded-[12px] font-medium hover:bg-[#059669] transition-colors"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question Navigator Sidebar */}
        <QuestionNavigator
          questions={questionsWithStatus}
          currentQuestionNumber={currentQuestionIndex + 1}
          onNavigateToQuestion={handleNavigateToQuestion}
        />
      </div>

      {/* Submit Modal */}
      <SubmitExamModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitExam}
        totalQuestions={questions.length}
        answeredQuestions={answeredCount}
        flaggedQuestions={flagged.size}
      />
    </div>
  );
}
