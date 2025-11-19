/**
 * React Router v7 Configuration
 * Following 2025 best practices with createBrowserRouter
 *
 * ROUTES IMPLEMENTED:
 * ✅ / - Landing page
 * ✅ /courses - Course catalog
 * ✅ /course/:courseId - Course home
 * ✅ /course/:courseId/topic/:topicId/practice - Topic practice
 * ✅ /course/:courseId/global - Global practice
 * ✅ /course/:courseId/topic/:topicId/compression - Compression notes
 * ✅ /exam/:examId - Exam simulation
 * ✅ /exam/:examId/session/:sessionId - Resume exam
 * ✅ /chat/:topicId - RAG chat (optional topic context)
 */

import { createBrowserRouter, RouteObject } from 'react-router-dom'

// Layout components
import RootLayout from './components/layouts/RootLayout'
import CourseLayout from './components/layouts/CourseLayout'

// Page components (will be created)
import LandingPage from './components/LandingPage'
import CourseCatalog from './components/CourseCatalog'
import CourseHome from './components/CourseHome'
import PracticeSession from './components/PracticeSession'
import GlobalPractice from './components/GlobalPractice'
import Compression from './components/blocks/Compression'
import ExamSimulation from './components/blocks/ExamSimulation'
import ChatPanel from './components/ChatPanel'

// Auth & Error components
import ProtectedRoute from './components/auth/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './components/NotFound'

/**
 * Route definitions with nested structure
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'courses',
        element: (
          <ProtectedRoute>
            <CourseCatalog />
          </ProtectedRoute>
        ),
      },
      {
        path: 'course/:courseId',
        element: (
          <ProtectedRoute>
            <CourseLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <CourseHome />,
          },
          {
            path: 'topic/:topicId/practice',
            element: <PracticeSession />,
          },
          {
            path: 'topic/:topicId/compression',
            element: <Compression />,
          },
          {
            path: 'global',
            element: <GlobalPractice />,
          },
        ],
      },
      {
        path: 'exam/:examId',
        element: (
          <ProtectedRoute>
            <ExamSimulation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'exam/:examId/session/:sessionId',
        element: (
          <ProtectedRoute>
            <ExamSimulation />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chat/:topicId?',
        element: (
          <ProtectedRoute>
            <ChatPanel />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]

/**
 * Create browser router with future flags
 */
export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
})
