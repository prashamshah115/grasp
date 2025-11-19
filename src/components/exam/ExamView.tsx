import { Trophy, Clock, FileCheck, Target, AlertCircle } from 'lucide-react';
import { Course } from '../../data/courses';
import { AIAssistant } from '../shared/AIAssistant';

interface ExamViewProps {
  course: Course;
  onStartExam: () => void;
}

export function ExamView({ course, onStartExam }: ExamViewProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="text-sm text-[#9CA3AF] mb-2">{course.code}</div>
          <h1 className="text-5xl mb-4 tracking-tight">Exam Simulation</h1>
          <p className="text-[#6B7280] text-lg">
            Full-length practice exams under timed conditions
          </p>
        </div>

        {/* Exam Info Card */}
        <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-[16px] p-10 mb-12">
          <div className="flex items-start justify-between mb-8">
            <div className="flex-1">
              <h2 className="text-3xl text-white mb-3">Finals Practice Exam</h2>
              <p className="text-[#FDE68A] text-lg mb-6">
                Simulates real exam conditions with timer and question navigation
              </p>
              
              {/* Exam Stats */}
              <div className="flex gap-6">
                <div className="flex items-center gap-2 text-white">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">120 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <FileCheck className="w-5 h-5" />
                  <span className="font-medium">50 questions</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={onStartExam}
              className="bg-white text-[#F59E0B] px-8 py-4 rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-all shadow-lg"
            >
              Start Exam
            </button>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-[14px] p-6 mb-12 flex gap-4">
          <AlertCircle className="w-6 h-6 text-[#4F46E5] flex-shrink-0" />
          <div>
            <div className="font-medium text-[#4F46E5] mb-1">Exam Support</div>
            <ul className="text-sm text-[#6B7280] space-y-1">
              <li>• Timer starts immediately when you begin</li>
              <li>• AI assistant available anytime - click the floating button for help</li>
              <li>• You can flag questions and return to them later</li>
              <li>• Review all answers before final submission</li>
            </ul>
          </div>
        </div>

        {/* Past Attempts */}
        <div>
          <h3 className="text-xl mb-4">Previous Attempts</h3>
          <div className="space-y-3">
            {/* Mock past attempt */}
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium mb-1">Practice Exam #1</div>
                  <div className="text-sm text-[#6B7280]">Completed 3 days ago</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-medium text-[#10B981]">82%</div>
                  <div className="text-sm text-[#6B7280]">41/50 correct</div>
                </div>
              </div>
              <button className="text-sm text-[#4F46E5] hover:text-[#4338CA] transition-colors">
                Review answers →
              </button>
            </div>

            {/* Empty state for first exam */}
            <div className="bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-[14px] p-8 text-center">
              <div className="text-[#6B7280]">
                No previous attempts yet. Take your first practice exam to get started.
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Assistant */}
      <AIAssistant context={`Course: ${course.code} - Exam Mode`} />
    </div>
  );
}