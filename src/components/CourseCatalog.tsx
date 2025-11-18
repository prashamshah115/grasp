import { FileUp } from 'lucide-react';
import { Course } from '../data/courses';
import { MasteryRing } from './MasteryRing';

interface CourseCatalogProps {
  courses: Course[];
  onViewCourse: (courseId: string) => void;
  onUploadCourse: () => void;
}

export function CourseCatalog({ courses, onViewCourse, onUploadCourse }: CourseCatalogProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl tracking-tight">grasp.ai</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-16">
          <h1 className="text-5xl mb-4 tracking-tight">
            What are you studying this quarter?
          </h1>
          <p className="text-lg text-[#6B7280]">
            Choose a course to begin your final prep
          </p>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => onViewCourse(course.id)}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] hover:shadow-sm transition-all duration-200"
            >
              {/* Mastery Ring */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-sm text-[#6B7280] mb-1">{course.code}</div>
                  <h3 className="text-xl mb-1">{course.title}</h3>
                </div>
                <MasteryRing percentage={course.masteryPercentage} size="sm" />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-6">
                <span>{course.totalTopics} Topics</span>
                <span>·</span>
                <span className="text-[#EF4444]">{course.weakSpots} Weak Spots</span>
                <span>·</span>
                <span>{course.reviewsDue} Reviews Due</span>
              </div>

              {/* CTA */}
              <div className="text-sm text-[#4F46E5]">
                Start Final Prep →
              </div>
            </button>
          ))}

          {/* Upload Card */}
          <button
            onClick={onUploadCourse}
            className="bg-[#F9FAFB] border-2 border-dashed border-[#D1D5DB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] hover:bg-[#F5F3FF] transition-all duration-200 flex flex-col items-center justify-center min-h-[280px]"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center mb-4">
              <FileUp className="w-7 h-7 text-[#6B7280]" />
            </div>
            <h3 className="text-xl mb-2 text-center">Upload Your Course Materials</h3>
            <p className="text-sm text-[#6B7280] text-center max-w-xs">
              Lectures, notes, assignments — we'll build everything
            </p>
          </button>
        </div>
      </main>
    </div>
  );
}
