/**
 * Finals Flow Card
 *
 * This card lives next to the Finals Pack and acts as the state machine for
 * the finals experience:
 *
 * - If no exam date → CTA that scrolls to Finals Pack date picker
 * - If date but no diagnostic → DiagnosticCard
 * - If date + diagnostic → StudyPlanEntryCard
 */

import { EmptyStateCtaCard } from './EmptyStateCtaCard';
import { DiagnosticCard } from './DiagnosticCard';
import { StudyPlanEntryCard } from './StudyPlanEntryCard';
import { useFinalsFlow } from '@/hooks/useFinals';
import { scrollToFinalsPackDatePicker } from './FinalsSection';

interface TaskCompressorCardProps {
  courseId: string;
  isCompact?: boolean;
}

export function TaskCompressorCard({ courseId, isCompact = false }: TaskCompressorCardProps) {
  const { flowStep, hasExamDate } = useFinalsFlow(courseId);

  if (flowStep === 'NEED_EXAM_DATE') {
    return (
      <EmptyStateCtaCard
        title="Set Your Final Exam Date"
        description="Choose your exam date on the Finals Pack card to unlock your personalized study plan."
        ctaLabel="Go to Finals Pack"
        onClick={scrollToFinalsPackDatePicker}
      />
    );
  }

  if (flowStep === 'NEED_DIAGNOSTIC') {
    return <DiagnosticCard courseId={courseId} hasExamDate={hasExamDate} />;
  }

  // READY: exam date + diagnostic complete → show study plan entry
  return <StudyPlanEntryCard courseId={courseId} />;
}

export default TaskCompressorCard;
