/**
 * CourseLayout Component
 * Layout for course pages with breadcrumbs and course context
 */

import { Outlet, useParams, Link } from 'react-router-dom'
import { Suspense } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useCourse } from '@/hooks'
import LoadingScreen from '../LoadingScreen'
import { Button } from '../ui/button'

export default function CourseLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const { data: course, isLoading } = useCourse(courseId)

  if (isLoading) {
    return <LoadingScreen message="Loading course..." />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Course Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link to="/courses">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Courses
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
