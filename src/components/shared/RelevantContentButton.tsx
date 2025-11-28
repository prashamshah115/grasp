/**
 * RelevantContentButton Component
 * 
 * Floating button positioned above the AI chat button to open the
 * relevant content viewer panel. Shows "Study relevant notes" label
 * with an indicator when content is available.
 */

import { BookOpen, Sparkles } from 'lucide-react'

interface RelevantContentButtonProps {
  onClick: () => void
  hasContent?: boolean
  isLoading?: boolean
}

export function RelevantContentButton({ 
  onClick, 
  hasContent = false,
  isLoading = false 
}: RelevantContentButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="fixed right-6 text-white px-5 py-3.5 rounded-[14px] shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed"
      style={{ 
        bottom: '112px', 
        zIndex: 45,
        background: 'linear-gradient(to right, #4F46E5, #7C3AED)'
      }}
      aria-label="Study relevant notes"
    >
      <div className="w-8 h-8 bg-white/20 rounded-[8px] flex items-center justify-center group-hover:bg-white/30 transition-colors">
        <BookOpen className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col items-start">
        <span className="font-medium text-sm">Study relevant notes</span>
        <span className="text-[10px] text-white/70">
          {isLoading ? 'Loading...' : hasContent ? 'View materials' : 'Course content'}
        </span>
      </div>
      <Sparkles className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
      
      {/* Green indicator dot when content is available */}
      {hasContent && !isLoading && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#10B981] rounded-full border-2 border-white animate-pulse" />
      )}
    </button>
  )
}

export default RelevantContentButton

