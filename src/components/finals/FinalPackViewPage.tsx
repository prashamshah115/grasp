/**
 * Final Pack View Page
 * Wrapper component for FinalPackView route
 * Provides required props from router context
 */

import { useParams, useNavigate } from 'react-router-dom';
import { FinalPackView } from './FinalPackView';
import { useCourse } from '@/hooks';
import LoadingScreen from '@/components/LoadingScreen';

export function FinalPackViewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(courseId);

  const handleStartPractice = (topicId?: string) => {
    if (topicId) {
      navigate(`/course/${courseId}/practice?topic=${topicId}`);
    } else {
      navigate(`/course/${courseId}/exam`);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading final pack..." />;
  }

  if (!course || !courseId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Course not found</p>
      </div>
    );
  }

  return (
    <FinalPackView
      courseId={courseId}
      courseCode={course.code}
      onStartPractice={handleStartPractice}
    />
  );
}

export default FinalPackViewPage;
