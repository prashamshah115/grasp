import { MasteryRing } from './MasteryRing';
import type { Course } from '@/types/course';

interface CourseCardProps {
  course: Course;
  onStartWorkout: (courseId: string) => void;
  onViewCourse: (courseId: string) => void;
}

export function CourseCard({ course, onStartWorkout, onViewCourse }: CourseCardProps) {
  return (
    <div
      className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-shadow cursor-pointer"
      style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}
      onClick={() => onViewCourse(course.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[#6B7280] mb-1">{course.code}</div>
          <h3 className="text-[#111827]">{course.name}</h3>
        </div>
        <MasteryRing percent={course.masteryPercent} size="small" showLabel={false} />
      </div>

      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <div className="text-[#6B7280]">Weak Spots</div>
          <div className="text-[#111827]">{course.weakSpots}</div>
        </div>
        <div>
          <div className="text-[#6B7280]">Reviews Due</div>
          <div className="text-[#111827]">{course.reviewsDue}</div>
        </div>
      </div>

      <button
        className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-4 rounded-[12px] transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onStartWorkout(course.id);
        }}
      >
        Start Exam Workout
      </button>
    </div>
  );
}
