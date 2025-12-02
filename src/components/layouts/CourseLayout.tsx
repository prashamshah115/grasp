/**
 * CourseLayout Component - PHASE 4 INTEGRATED
 * Layout for course pages with 3-pillar navigation
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Includes NavBar with Practice/Compression/Exam tabs
 * - Uses useCourse() hook for course data
 * - Breadcrumb navigation: Courses / Course Code (links to course home)
 */

import { Outlet, useParams, Link, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { useCourse } from '@/hooks'
import LoadingScreen from '../LoadingScreen'
import { Button } from '../ui/button'
import { NavBar } from '../navigation/NavBar'

export default function CourseLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const location = useLocation()
  const { data: course, isLoading } = useCourse(courseId)

  // Check if we're on a sub-page (not the course home)
  const isSubPage = location.pathname !== `/course/${courseId}` && 
                    location.pathname !== `/course/${courseId}/`

  if (isLoading) {
    return <LoadingScreen message="Loading course..." />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 3-Pillar Navigation */}
      <NavBar />

      {/* Course Header (breadcrumb navigation) */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm">
              <Link 
                to="/courses" 
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Courses
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {isSubPage ? (
                <>
                  <Link 
                    to={`/course/${courseId}`}
                    className="text-gray-500 hover:text-gray-900 transition-colors font-medium"
                  >
                    {course?.code || 'Course'}
                  </Link>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">
                    {getPageTitle(location.pathname)}
                  </span>
                </>
              ) : (
                <span className="text-gray-900 font-medium">
                  {course?.code || 'Course'}
                </span>
              )}
            </nav>

            {/* Back to Course Home Button (shown on sub-pages) */}
            {isSubPage && course && (
              <Link to={`/course/${courseId}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">{course.code} Home</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Course Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

// Helper to get page title from pathname
function getPageTitle(pathname: string): string {
  if (pathname.includes('/practice')) return 'Practice'
  if (pathname.includes('/compression')) return 'Compression'
  if (pathname.includes('/exam')) return 'Exam'
  if (pathname.includes('/finals/pack')) return 'Final Pack'
  if (pathname.includes('/finals/plan')) return 'Study Plan'
  if (pathname.includes('/finals/upload')) return 'Upload'
  return 'Page'
}
