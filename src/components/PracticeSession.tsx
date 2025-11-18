import { useState } from 'react';
import { ArrowLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { Course, warmupQuestions, examProblems, mistakeQuestions, Question } from '../data/courses';

interface PracticeSessionProps {
  mode: 'quick-recall' | 'weak-spots' | 'exam-problems' | 'mistake-replay' | 'compression';
  course: Course;
  onComplete: () => void;
  onExit: () => void;
}

export function PracticeSession({ mode, course, onComplete, onExit }: PracticeSessionProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Get questions based on mode
  const getQuestions = () => {
    switch (mode) {
      case 'quick-recall':
        return warmupQuestions;
      case 'exam-problems':
        return examProblems;
      case 'mistake-replay':
        return mistakeQuestions;
      default:
        return warmupQuestions;
    }
  };

  const questions = getQuestions();
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const modeTitles = {
    'quick-recall': 'Quick Recall',
    'weak-spots': 'Weak Spots',
    'exam-problems': 'Exam Problems',
    'mistake-replay': 'Mistake Replay',
    'compression': 'Compression'
  };

  const handleSubmit = () => {
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setShowFeedback(false);
      setShowHint(false);
    } else {
      onComplete();
    }
  };

  const isExamMode = mode === 'exam-problems';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Exit</span>
          </button>
          <div className="flex items-center gap-8">
            <span className="text-sm text-[#6B7280]">
              {modeTitles[mode]}
            </span>
            <span className="text-sm text-[#6B7280]">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[#F9FAFB] h-1">
        <div
          className="bg-[#4F46E5] h-1 transition-all duration-300"
          style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-8 py-16">
        {/* Question Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 mb-8">
          {isExamMode && currentQuestion.source && (
            <div className="text-sm text-[#6B7280] mb-6 pb-4 border-b border-[#E5E7EB]">
              {currentQuestion.source}
            </div>
          )}
          <div className="text-2xl mb-8 leading-relaxed">
            {currentQuestion.question}
          </div>

          {/* Answer Input */}
          {!showFeedback && (
            <div className="space-y-4">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full min-h-[120px] p-4 border border-[#E5E7EB] rounded-[12px] text-lg resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim()}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Check Answer
                </button>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-2 text-[#6B7280] hover:text-[#4F46E5] transition-colors px-4 py-3"
                >
                  <Lightbulb className="w-5 h-5" />
                  <span className="text-sm">{showHint ? 'Hide' : 'Show'} Hint</span>
                </button>
              </div>

              {/* Hint */}
              {showHint && currentQuestion.hint && (
                <div className="bg-[#FEF3C7] border border-[#FDE047] rounded-[12px] p-4 text-sm">
                  <div className="text-[#92400E] mb-1">💡 Hint</div>
                  <div className="text-[#92400E]">{currentQuestion.hint}</div>
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {showFeedback && (
            <div className="space-y-6">
              {/* Correct Answer */}
              <div className="bg-[#F0FDF4] border border-[#22C55E] rounded-[12px] p-6">
                <div className="text-sm text-[#166534] mb-2">✓ Correct Answer</div>
                <div className="text-[#166534]">{currentQuestion.correctAnswer}</div>
              </div>

              {/* Explanation */}
              {currentQuestion.explanation && (
                <div className="bg-[#F9FAFB] rounded-[12px] p-6">
                  <div className="text-sm text-[#6B7280] mb-2">Explanation</div>
                  <div className="text-[#111827]">{currentQuestion.explanation}</div>
                </div>
              )}

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-4 rounded-[12px] transition-all duration-200 flex items-center justify-center gap-2"
              >
                {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Complete Session'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}