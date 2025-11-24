/**
 * CourseCatalog Component - PHASE 4 INTEGRATED
 * Course selection page
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useCourses() hook for course data (React Query)
 * - Uses useNavigate() for navigation
 * - NO props, NO mock data
 */

import { FileUp, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCourses, useUserCourses, useAddCourse, useUploadCourseMaterial } from '@/hooks';
import LoadingScreen from './LoadingScreen';
import { useAuth } from '@/components/auth/AuthProvider';
import { useState, useRef } from 'react';
import type { Course } from '@/types/course';

// Type for user course with course details
type UserCourseWithDetails = {
  course_id: string;
  courses: Course | null;
};

export function CourseCatalog() {
  const navigate = useNavigate();
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: userCourses, isLoading: userCoursesLoading } = useUserCourses();
  const { user, signOut } = useAuth();
  const addCourse = useAddCourse();
  const uploadCourseMaterial = useUploadCourseMaterial();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const isLoading = coursesLoading || userCoursesLoading;

  if (isLoading) {
    return <LoadingScreen message="Loading courses..." />;
  }

  // Get enrolled course IDs for filtering/highlighting
  const enrolledCourseIds = new Set(
    userCourses?.map((uc: any) => uc.course_id) || []
  );

  const handleViewCourse = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const handleAddCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic UI: disable button immediately
    const button = e.currentTarget as HTMLButtonElement;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Enrolling...';
    
    try {
      await addCourse.mutateAsync(courseId);
      // Success - button will be disabled by "Already enrolled" state
    } catch (error: any) {
      // Handle duplicate enrollment gracefully
      if (error?.code === '23505' || 
          error?.message?.includes('duplicate') || 
          error?.message?.includes('unique')) {
        // Already enrolled - this is fine, just show success state
        console.log('Already enrolled in course');
      } else {
        console.error('Failed to add course:', error);
        // Restore button on error
        button.disabled = false;
        button.textContent = originalText;
        alert('Failed to enroll in course. Please try again.');
      }
    }
  };

  const handleUploadClick = () => {
    // Check if user has enrolled courses
    if (!userCourses || userCourses.length === 0) {
      alert('Please enroll in a course first before uploading materials.');
      return;
    }

    // If only one course, use it; otherwise require selection
    if (userCourses.length === 1) {
      const course = userCourses[0] as UserCourseWithDetails;
      if (!course?.course_id) {
        alert('Invalid course data');
        return;
      }
      setSelectedCourseId(course.course_id);
      fileInputRef.current?.click();
    } else {
      // For multiple courses, show selection (for now, use first enrolled course)
      // TODO: Add course selection UI
      const course = userCourses[0] as UserCourseWithDetails;
      if (!course?.course_id) {
        alert('Invalid course data');
        return;
      }
      setSelectedCourseId(course.course_id);
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    // Ensure we have a courseId
    if (!selectedCourseId) {
      alert('Please select a course first');
      return;
    }

    setIsUploading(true);
    try {
      await uploadCourseMaterial.mutateAsync({ file, courseId: selectedCourseId });
      alert('Course material uploaded successfully! Processing will begin shortly.');
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedCourseId(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload course material. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const displayName = user?.name?.split(' ')[0] ?? 'Your';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl tracking-tight">grasp.ai</h1>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-[#F9FAFB] rounded-[10px]">
                <div className="w-8 h-8 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-[#374151]">{user.name}</span>
              </div>

              <button
                onClick={signOut}
                className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[8px] transition-all"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-16">
          <h1 className="text-5xl mb-4 tracking-tight">
            {displayName}'s courses
          </h1>
          <p className="text-lg text-[#6B7280]">
            Choose a course to begin your final prep
          </p>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses?.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            return (
              <div
                key={course.id}
                className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 hover:border-[#4F46E5] hover:shadow-sm transition-all duration-200 relative"
              >
                {/* Course Info */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="text-sm text-[#6B7280] mb-1">{course.code}</div>
                    <h3 className="text-xl mb-1">{course.name}</h3>
                    {course.term && (
                      <div className="text-xs text-[#9CA3AF]">{course.term}</div>
                    )}
                  </div>
                  {isEnrolled && (
                    <div className="ml-2 px-2 py-1 bg-[#D1FAE5] text-[#065F46] text-xs font-medium rounded">
                      Enrolled
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleViewCourse(course.id)}
                    className="text-sm text-[#4F46E5] hover:text-[#4338CA]"
                  >
                    Start Final Prep →
                  </button>
                  {!isEnrolled && (
                    <button
                      onClick={(e) => handleAddCourse(course.id, e)}
                      disabled={addCourse.isPending}
                      className="px-3 py-1 text-xs bg-[#F3F4F6] text-[#374151] rounded hover:bg-[#E5E7EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addCourse.isPending ? 'Adding...' : '+ Add'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Upload Card */}
          <button
            onClick={handleUploadClick}
            disabled={isUploading || uploadCourseMaterial.isPending}
            className="bg-[#F9FAFB] border-2 border-dashed border-[#D1D5DB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] hover:bg-[#F5F3FF] transition-all duration-200 flex flex-col items-center justify-center min-h-[280px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center mb-4">
              <FileUp className="w-7 h-7 text-[#6B7280]" />
            </div>
            <h3 className="text-xl mb-2 text-center">
              {isUploading || uploadCourseMaterial.isPending
                ? 'Uploading...'
                : 'Upload Your Course Materials'}
            </h3>
            <p className="text-sm text-[#6B7280] text-center max-w-xs">
              Lectures, notes, assignments — we'll build everything
            </p>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </main>
    </div>
  );
}
