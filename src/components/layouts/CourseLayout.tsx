/**
 * CourseLayout Component - PHASE 4 INTEGRATED
 * Layout for course pages with 3-pillar navigation
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Includes NavBar with Practice/Compression/Exam tabs
 * - Uses useCourse() hook for course data
 * - Breadcrumb navigation back to courses
 */

import { Outlet, useParams, Link } from 'react-router-dom'
import { Suspense } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useCourse } from '@/hooks'
import LoadingScreen from '../LoadingScreen'
import { Button } from '../ui/button'
import { NavBar } from '../navigation/NavBar'

export default function CourseLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const { data: course, isLoading } = useCourse(courseId)

  if (isLoading) {
    return <LoadingScreen message="Loading course..." />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 3-Pillar Navigation */}
      <NavBar />

      {/* Course Header (breadcrumb + course info) */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link to="/courses">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back To Courses
              </Button>
            </Link>
            {course && (
              <div>
                <h1 className="text-xl font-semibold text-text-primary">
                  {course.code}
                </h1>
                <p className="text-sm text-text-secondary">{course.name}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Course Content */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
