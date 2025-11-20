import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { ExamProblem } from '@/types/legacy';

interface ExamSimulationProps {
  problems: ExamProblem[];
  onComplete: () => void;
}

export function ExamSimulation({ problems, onComplete }: ExamSimulationProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const problem = problems[0]; // Use first problem

  const handleSubmit = () => {
    if (!answer.trim()) return;
    setSubmitted(true);
  };

  const handleNext = () => {
    onComplete();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[#6B7280]">Real exam problem from past exams</p>
      </div>

      {!submitted ? (
        <>
          {/* Problem Card */}
          <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-4">
              <FileText className="w-4 h-4" />
              <span>{problem.examLabel}</span>
            </div>

            {problem.sections.map((section, index) => (
              <div key={index} className="mb-4">
                <h4 className="text-sm mb-2">{section.label}</h4>
                <p className="text-[#111827]">{section.content}</p>
              </div>
            ))}
          </div>

          {/* Answer Section */}
          <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <h4 className="mb-4">Your Answer</h4>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your solution and reasoning..."
              rows={8}
              className="w-full px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] mb-4 resize-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Comparison View */}
          <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <h3 className="text-xl mb-6">Solution Comparison</h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Student Answer */}
              <div>
                <h4 className="text-sm text-[#6B7280] mb-3">Your Answer</h4>
                <div className="bg-[#F9FAFB] rounded-[12px] p-4 border border-[#E5E7EB]">
                  <p className="text-sm whitespace-pre-wrap">{answer}</p>
                </div>
              </div>

              {/* Model Solution */}
              <div>
                <h4 className="text-sm text-[#6B7280] mb-3">Model Solution</h4>
                <div className="bg-[#22C55E]/5 rounded-[12px] p-4 border border-[#22C55E]/20">
                  <p className="text-sm whitespace-pre-wrap">{problem.modelSolution}</p>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="mt-6 p-4 bg-[#FACC15]/10 rounded-[12px] border border-[#FACC15]/20">
              <p className="text-sm">
                <strong>Key differences:</strong> Your answer covered the basics but could elaborate more on the memory overhead comparison and the on-demand allocation benefit.
              </p>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors"
          >
            Continue to Next Block
          </button>
        </>
      )}
    </div>
  );
}
