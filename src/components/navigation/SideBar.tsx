import type { Course } from '@/types/course';
import { MasteryRing } from '../MasteryRing';
import { ArrowLeft } from 'lucide-react';

interface SideBarProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string) => void;
  onBackToCatalog: () => void;
}

export function SideBar({ courses, selectedCourseId, onSelectCourse, onBackToCatalog }: SideBarProps) {
  return (
    <aside className="w-80 border-r border-[#E5E7EB] bg-white h-[calc(100vh-64px)] overflow-y-auto">
      <div className="p-6">
        {/* Back to Catalog Button */}
        <button
          onClick={onBackToCatalog}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">All Courses</span>
        </button>

        <div className="text-sm text-[#9CA3AF] mb-4">Your Courses</div>
        
        <div className="space-y-2">
          {courses.map((course) => {
            const isSelected = selectedCourseId === course.id;
            
            return (
              <button
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                className={`w-full text-left p-4 rounded-[12px] transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#F5F3FF] border border-[#4F46E5]'
                    : 'bg-white border border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Mastery Ring */}
                  <div className="flex-shrink-0 mt-1">
                    <MasteryRing percentage={course.masteryPercentage} size="sm" />
                  </div>
                  
                  {/* Course Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#9CA3AF] mb-1">{course.code}</div>
                    <div className="font-medium mb-2 truncate">{course.title}</div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                      <div>{course.totalTopics} topics</div>
                      {course.weakSpots > 0 && (
                        <div className="text-[#EF4444]">{course.weakSpots} weak</div>
                      )}
                      {course.examInDays !== null && (
                        <div className="text-[#4F46E5] font-medium">
                          {course.examInDays}d to exam
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Add Course Button */}
        <button className="w-full mt-4 p-4 rounded-[12px] border-2 border-dashed border-[#E5E7EB] text-[#6B7280] hover:border-[#4F46E5] hover:text-[#4F46E5] transition-colors">
          + Add Course
        </button>
      </div>
    </aside>
  );
}