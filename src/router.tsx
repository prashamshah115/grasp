/**
 * React Router v7 Configuration - PHASE 4 CORRECTED
 * Following 2025 best practices with createBrowserRouter
 *
 * ROUTES IMPLEMENTED (CORRECTED):
 * ✅ / - Landing page
 * ✅ /courses - Course catalog
 * ✅ /course/:courseId - Course home with 3-pillar tabs
 * ✅ /course/:courseId/practice - Practice pillar view
 * ✅ /course/:courseId/compression - Compression pillar view
 * ✅ /course/:courseId/exam - Exam pillar view (list of exams)
 * ✅ /session/:sessionId - GLOBAL practice session (not nested)
 * ✅ /exam/:examId - Exam definition/instructions page
 * ✅ /exam/:examId/start - Create exam session (loader redirects)
 * ✅ /exam-session/:sessionId - Full-screen exam session
 * ✅ /exam/:examId/results - Exam results page
 * ✅ /chat/:topicId? - RAG chat (optional topic context)
 */

import { createBrowserRouter, RouteObject, redirect } from 'react-router-dom'

// Layout components (default exports)
import RootLayout from './components/layouts/RootLayout'
import CourseLayout from './components/layouts/CourseLayout'

// Page components (mixed exports)
import { LandingPage } from './components/LandingPage'
import { CourseCatalog } from './components/CourseCatalog'
import { CourseHome } from './components/CourseHome'
import ChatPanel from './components/ChatPanel'

// New UI components from Figma (named exports)
import { PracticeView } from './components/practice/PracticeView'
import { CompressionView } from './components/compression/CompressionView'
import { ExamView } from './components/exam/ExamView'
import { ExamSimulation } from './components/exam/ExamSimulation'

// Practice session component (named export)
import { PracticeSession } from './components/PracticeSession'

// Placeholder components (default exports)
import ExamDefinition from './components/ExamDefinition'
import ExamResults from './components/ExamResults'

// Auth & Error components (default exports)
import ProtectedRoute from './components/auth/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './components/NotFound'

/**
 * Route definitions with corrected nested structure
 * KEY: Practice/Exam sessions are GLOBAL routes, not nested under course
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Landing page
      {
        index: true,
        element: <LandingPage />,
      },

      // Course catalog
      {
        path: 'courses',
        element: (
          <ProtectedRoute>
            <CourseCatalog />
          </ProtectedRoute>
        ),
      },

      // Course layout with 3-pillar navigation (Practice/Compression/Exam)
      {
        path: 'course/:courseId',
        element: (
          <ProtectedRoute>
            <CourseLayout />
          </ProtectedRoute>
        ),
        children: [
          // Default redirect to practice pillar
          {
            index: true,
            element: <CourseHome />,
          },
          // Practice pillar
          {
            path: 'practice',
            element: <PracticeView />,
          },
          // Compression pillar
          {
            path: 'compression',
            element: <CompressionView />,
          },
          // Exam pillar (list of exams)
          {
            path: 'exam',
            element: <ExamView />,
          },
        ],
      },

      // GLOBAL practice session route (NOT nested under course)
      {
        path: 'session/:sessionId',
        element: (
          <ProtectedRoute>
            <PracticeSession />
          </ProtectedRoute>
        ),
      },

      // Exam definition page (instructions, metadata)
      {
        path: 'exam/:examId',
        element: (
          <ProtectedRoute>
            <ExamDefinition />
          </ProtectedRoute>
        ),
      },

      // Exam start route (loader creates session, redirects to exam-session)
      {
        path: 'exam/:examId/start',
        loader: async ({ params }) => {
          // This will be implemented with useCreateExamSession mutation
          // For now, placeholder redirect
          return redirect(`/exam-session/placeholder`)
        },
        element: null,
      },

      // Full-screen exam session
      {
        path: 'exam-session/:sessionId',
        element: (
          <ProtectedRoute>
            <ExamSimulation />
          </ProtectedRoute>
        ),
      },

      // Exam results page
      {
        path: 'exam/:examId/results',
        element: (
          <ProtectedRoute>
            <ExamResults />
          </ProtectedRoute>
        ),
      },

      // Standalone RAG chat (optional topic context)
      {
        path: 'chat/:topicId?',
        element: (
          <ProtectedRoute>
            <ChatPanel />
          </ProtectedRoute>
        ),
      },

      // 404 Not Found
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
