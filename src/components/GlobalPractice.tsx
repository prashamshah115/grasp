/**
 * GlobalPractice Component
 * Adaptive question practice using spaced repetition
 * TODO: Full implementation in Phase 4
 */

import { useParams } from 'react-router-dom'

export default function GlobalPractice() {
  const { courseId } = useParams<{ courseId: string }>()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Global Practice</h1>
        <p className="text-text-secondary">
          Adaptive question selection using spaced repetition
        </p>
      </div>

      <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
        <p className="text-text-tertiary">
          Global Practice component (Phase 4)
        </p>
        <p className="text-sm text-text-tertiary mt-2">
          Course ID: {courseId}
        </p>
      </div>
    </div>
  )
}
