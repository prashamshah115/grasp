/**
 * RelevantContentViewer Component
 * 
 * Slide-in panel displaying relevant course content for the current question.
 * Shows text content with source citations, navigation between chunks.
 */

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, BookOpen, FileText, Loader2, AlertCircle } from 'lucide-react'
import type { RelevantContentResponse } from '@/lib/api'

interface RelevantContentViewerProps {
  isOpen: boolean
  onClose: () => void
  data: RelevantContentResponse | undefined
  isLoading: boolean
  error: Error | null
  courseName?: string
}

export function RelevantContentViewer({
  isOpen,
  onClose,
  data,
  isLoading,
  error,
  courseName = 'Course Materials'
}: RelevantContentViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!isOpen) return null

  const chunks = data?.chunks || []
  const totalChunks = chunks.length
  const currentChunk = chunks[currentIndex]

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(totalChunks - 1, prev + 1))
  }

  // Reset to first chunk when data changes
  const handleClose = () => {
    setCurrentIndex(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={handleClose} />
      
      {/* Slide-in Panel */}
      <div className="relative h-full w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[10px] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#111827]">
                Lecture Slides & Notes
              </h2>
              <p className="text-sm text-[#6B7280]">{courseName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#F3F4F6] rounded-[8px] transition-colors"
            aria-label="Close content viewer"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Navigation Controls */}
        {totalChunks > 0 && (
          <div className="px-8 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB] flex-shrink-0">
            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="p-2 hover:bg-white rounded-[8px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous content"
              >
                <ChevronLeft className="w-5 h-5 text-[#374151]" />
              </button>
              
              <div className="px-4 py-2 bg-white rounded-[8px] border border-[#E5E7EB]">
                <span className="text-sm font-medium text-[#111827]">
                  {currentIndex + 1} / {totalChunks}
                </span>
              </div>
              
              <button
                onClick={handleNext}
                disabled={currentIndex === totalChunks - 1}
                className="p-2 hover:bg-white rounded-[8px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next content"
              >
                <ChevronRight className="w-5 h-5 text-[#374151]" />
              </button>
            </div>

            {/* Source info */}
            {data?.source && (
              <div className="text-xs text-[#6B7280] bg-white px-3 py-1.5 rounded-full border border-[#E5E7EB]">
                {data.source === 'vector' ? '🎯 Best matches' : data.source === 'topic' ? '📚 Topic content' : ''}
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#F3F4F6] p-8">
          <div className="max-w-4xl mx-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-[12px] shadow-lg border border-[#E5E7EB] p-12 text-center">
                <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mx-auto mb-4" />
                <p className="text-[#6B7280]">Finding relevant content...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="bg-white rounded-[12px] shadow-lg border border-[#E5E7EB] p-12 text-center">
                <AlertCircle className="w-8 h-8 text-[#EF4444] mx-auto mb-4" />
                <p className="text-[#111827] font-medium mb-2">Unable to load content</p>
                <p className="text-sm text-[#6B7280]">{error.message}</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && totalChunks === 0 && (
              <div className="bg-white rounded-[12px] shadow-lg border border-[#E5E7EB] p-12 text-center">
                <BookOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                <p className="text-[#111827] font-medium mb-2">No content available</p>
                <p className="text-sm text-[#6B7280]">
                  There are no relevant course materials for this question yet.
                </p>
              </div>
            )}

            {/* Content Display */}
            {!isLoading && !error && currentChunk && (
              <div className="bg-white rounded-[12px] shadow-lg border border-[#E5E7EB] p-8">
                {/* Source Citation */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E5E7EB]">
                  <BookOpen className="w-5 h-5 text-[#4F46E5]" />
                  <div>
                    <h3 className="text-base font-medium text-[#111827]">
                      {currentChunk.doc_title}
                    </h3>
                    <p className="text-sm text-[#6B7280]">
                      Page {currentChunk.page_number} • {formatDocType(currentChunk.doc_type)}
                      {currentChunk.similarity > 0 && (
                        <span className="ml-2 text-[#10B981]">
                          {(currentChunk.similarity * 100).toFixed(0)}% match
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Content Text */}
                <div className="prose prose-slate max-w-none">
                  <div className="text-[#374151] leading-relaxed whitespace-pre-wrap text-[15px]">
                    {formatContent(currentChunk.content)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex-shrink-0">
          <p className="text-sm text-[#6B7280] text-center">
            💡 Reference these materials while working on problems
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

// Helper to format document type for display
function formatDocType(docType: string): string {
  const types: Record<string, string> = {
    slides: 'Lecture Slides',
    textbook: 'Textbook',
    notes: 'Notes',
    homework: 'Homework',
    exam: 'Exam',
    other: 'Document',
  }
  return types[docType] || 'Document'
}

// Helper to clean and format content
function formatContent(content: string): string {
  if (!content) return ''
  
  // Trim excessive whitespace while preserving paragraph breaks
  return content
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/[ \t]+/g, ' ') // Collapse spaces
    .trim()
}

export default RelevantContentViewer


