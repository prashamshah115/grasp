import { Activity, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { scrollToFinalsPackDatePicker } from './FinalsSection';
import { useAuth } from '@/components/auth/AuthProvider';
import { startPracticeFinalDiagnostic } from '@/lib/finals';
import { fetchExams } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import { useState } from 'react';

interface DiagnosticCardProps {
  courseId?: string;
  hasExamDate?: boolean;
}

export function DiagnosticCard({ courseId: propCourseId, hasExamDate }: DiagnosticCardProps) {
  const navigate = useNavigate();
  const { courseId: paramCourseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseId = propCourseId || paramCourseId || '';

  // Query for practice final (for UI display only)
  const { data: exams } = useQuery({
    queryKey: queryKeys.exams.byCourse(courseId),
    queryFn: () => fetchExams(courseId),
    enabled: !!courseId,
  });

  const practiceFinal = exams?.find(e => e.exam_type === 'practice');

  const handleStart = async () => {
    if (!hasExamDate) {
      scrollToFinalsPackDatePicker();
      return;
    }

    if (!courseId || !user) {
      console.warn('[DiagnosticCard] Missing courseId or user, cannot start diagnostic.');
      return;
    }

    if (isStarting) {
      return; // Prevent double-clicks
    }

    setIsStarting(true);
    setError(null);

    try {
      const { sessionId } = await startPracticeFinalDiagnostic(courseId, user.id);
      navigate(`/exam-session/${sessionId}`, {
        state: { isDiagnostic: true }, // Route state for immediate use
      });
    } catch (err: any) {
      console.error('[DiagnosticCard] Failed to start practice final:', err);
      if (err.message === 'NO_PRACTICE_FINAL') {
        setError('NO_PRACTICE_FINAL');
      } else {
        setError('Failed to start practice final. Please try again.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Handle missing practice final
  if (!practiceFinal && !isStarting && !error) {
    return (
      <Card className="h-full flex flex-col border border-[#E5E7EB] rounded-[20px]">
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Practice Final Coming Soon</h3>
          <p className="text-sm text-[#6B7280]">
            The instructor hasn't added a practice final for this course yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border border-[#E5E7EB] rounded-[20px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 rounded-full bg-[#DBEAFE] flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#2563EB]" />
          </div>
          Take the Practice Final
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-8">
        <div className="flex-1">
          <p className="text-sm text-[#4B5563] mb-3">
            Complete the practice final exam. We'll generate a personalized study plan based on your performance across all topics.
          </p>
          <p className="text-xs text-[#6B7280]">
            We'll use your results together with your finals date to build a realistic schedule from now until the exam.
          </p>
          {error && error !== 'NO_PRACTICE_FINAL' && (
            <p className="text-xs text-[#EF4444] mt-2">{error}</p>
          )}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting}
            className="px-5 py-2.5 bg-[#4F46E5] bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm rounded-[10px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md flex items-center justify-center gap-2 group relative z-10"
          >
            <Activity className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
            <span className="whitespace-nowrap">{isStarting ? 'Starting...' : 'Start Practice Final'}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DiagnosticCard;


