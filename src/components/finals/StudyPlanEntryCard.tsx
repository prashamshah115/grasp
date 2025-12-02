import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, Clock, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudyPlan } from '@/hooks/useFinals';

interface StudyPlanEntryCardProps {
  courseId?: string;
}

export function StudyPlanEntryCard({ courseId: propCourseId }: StudyPlanEntryCardProps) {
  const navigate = useNavigate();
  const { courseId: paramCourseId } = useParams<{ courseId: string }>();
  const courseId = propCourseId || paramCourseId || '';

  const { data: plan } = useStudyPlan(courseId);

  const handleOpenPlan = () => {
    if (!courseId) {
      console.warn('[StudyPlanEntryCard] Missing courseId, cannot navigate to study plan');
      return;
    }
    navigate(`/course/${courseId}/finals/plan`);
  };

  const totalDays = plan?.plan_content?.length ?? 0;
  const totalMinutes = plan?.plan_content?.reduce(
    (sum, day) => sum + (day.estimated_minutes ?? 0),
    0
  );

  return (
    <Card className="h-full flex flex-col border border-[#E5E7EB] rounded-[20px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#4F46E5]" />
          </div>
          Your Study Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between pb-6">
        {plan ? (
          <div className="space-y-3">
            <p className="text-sm text-[#4B5563]">
              You have an active plan targeting{' '}
              <span className="font-medium text-[#111827]">
                {plan.target_date || 'your final date'}
              </span>
              .
            </p>
            <div className="flex items-center gap-4 text-xs text-[#6B7280]">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{totalDays} days</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{totalMinutes} min total</span>
              </div>
            </div>
            <p className="text-xs text-[#6B7280]">
              We’ve balanced your weak topics and prerequisites across the remaining days until your
              exam.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#4B5563]">
              You’re ready to generate a personalized multi-day plan based on your diagnostic results.
            </p>
            <p className="text-xs text-[#6B7280]">
              If you don’t see a plan yet, it may still be generating in the background. You can always
              open the plan view and regenerate if needed.
            </p>
          </div>
        )}

        <div className="mt-5">
          <Button className="w-full" size="sm" onClick={handleOpenPlan}>
            Open Today&apos;s Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StudyPlanEntryCard;


