/**
 * RelevantContentViewer Component - PRODUCTION GRADE EDTECH FORMATTING
 * 
 * Slide-in panel displaying relevant course content for the current question.
 * Production-grade formatting like Khan Academy/Duolingo with:
 * - Beautiful typography and spacing
 * - Markdown support with syntax highlighting
 * - Code blocks with proper formatting
 * - Visual hierarchy and emphasis
 * - Professional source citations
 */

import { useState, useMemo, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, BookOpen, FileText, Loader2, AlertCircle, Sparkles, Target, Lightbulb } from 'lucide-react'
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

  const chunks = data?.chunks || []
  const totalChunks = chunks.length

  // Organize content by document and relevance - USEFUL STRUCTURE
  const organizedContent = useMemo(() => {
    if (!chunks.length) return []
    
    // Group by document
    const byDocument = new Map<string, typeof chunks>()
    chunks.forEach(chunk => {
      const key = chunk.doc_title || 'Unknown'
      if (!byDocument.has(key)) {
        byDocument.set(key, [])
      }
      byDocument.get(key)!.push(chunk)
    })
    
    // Sort documents by highest relevance
    const documents = Array.from(byDocument.entries())
      .map(([title, docChunks]) => ({
        title,
        chunks: docChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0)),
        maxSimilarity: Math.max(...docChunks.map(c => c.similarity || 0)),
        docType: docChunks[0]?.doc_type || 'other',
        pageNumbers: [...new Set(docChunks.map(c => c.page_number).filter(Boolean))].sort((a, b) => a - b)
      }))
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
    
    return documents
  }, [chunks])

  // Reset index when content changes or panel opens
  useEffect(() => {
    if (isOpen && organizedContent.length > 0) {
      setCurrentIndex(0)
    }
  }, [organizedContent.length, isOpen])

  const currentDoc = organizedContent[currentIndex]
  const currentChunk = currentDoc?.chunks[0] // Show most relevant chunk from current doc

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(organizedContent.length - 1, prev + 1))
  }

  // Reset to first chunk when closing
  const handleClose = () => {
    setCurrentIndex(0)
    onClose()
  }

  // Early return AFTER all hooks
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={handleClose} />
      
      {/* Slide-in Panel */}
      <div className="relative h-full w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Header - Production Grade */}
        <div className="px-8 py-6 border-b border-[#E5E7EB] bg-gradient-to-r from-white to-[#F9FAFB] flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[12px] flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#111827] mb-1">
                Study Materials
              </h2>
              <p className="text-sm text-[#6B7280] font-medium">{courseName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2.5 hover:bg-[#F3F4F6] rounded-[10px] transition-all hover:scale-105"
            aria-label="Close content viewer"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Navigation Controls - Organized by Document */}
        {organizedContent.length > 0 && (
          <div className="px-8 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-gradient-to-r from-[#F9FAFB] to-white flex-shrink-0">
            {/* Page Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="p-2.5 hover:bg-white rounded-[10px] transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md disabled:hover:shadow-none border border-transparent hover:border-[#E5E7EB]"
                aria-label="Previous document"
              >
                <ChevronLeft className="w-5 h-5 text-[#374151]" />
              </button>
              
              <div className="px-5 py-2.5 bg-white rounded-[10px] border border-[#E5E7EB] shadow-sm">
                <span className="text-sm font-semibold text-[#111827]">
                  {currentIndex + 1} <span className="text-[#6B7280] font-normal">of</span> {organizedContent.length}
                </span>
              </div>
              
              <button
                onClick={handleNext}
                disabled={currentIndex === organizedContent.length - 1}
                className="p-2.5 hover:bg-white rounded-[10px] transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md disabled:hover:shadow-none border border-transparent hover:border-[#E5E7EB]"
                aria-label="Next document"
              >
                <ChevronRight className="w-5 h-5 text-[#374151]" />
              </button>
            </div>

            {/* Source info - Enhanced */}
            {data?.source && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#E5E7EB] shadow-sm">
                {data.source === 'vector' ? (
                  <>
                    <Target className="w-4 h-4 text-[#4F46E5]" />
                    <span className="text-xs font-medium text-[#111827]">Most Relevant</span>
                  </>
                ) : data.source === 'topic' ? (
                  <>
                    <BookOpen className="w-4 h-4 text-[#10B981]" />
                    <span className="text-xs font-medium text-[#111827]">Topic Content</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Content Area - Production Grade */}
        <div className="flex-1 overflow-auto bg-gradient-to-b from-[#FAFAFA] to-[#F3F4F6] p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Loading State - Production Grade */}
            {isLoading && (
              <div className="bg-white rounded-[16px] shadow-xl border border-[#E5E7EB] p-16 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin" />
                </div>
                <p className="text-[#111827] font-semibold text-lg mb-2">Finding relevant content...</p>
                <p className="text-sm text-[#6B7280]">Searching through course materials</p>
              </div>
            )}

            {/* Error State - Production Grade */}
            {error && !isLoading && (
              <div className="bg-white rounded-[16px] shadow-xl border border-[#FEE2E2] p-16 text-center">
                <div className="w-16 h-16 bg-[#FEE2E2] rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-[#EF4444]" />
                </div>
                <p className="text-[#111827] font-semibold text-lg mb-2">Unable to load content</p>
                <p className="text-sm text-[#6B7280] max-w-md mx-auto">{error.message}</p>
              </div>
            )}

            {/* Empty State - Production Grade */}
            {!isLoading && !error && organizedContent.length === 0 && (
              <div className="bg-white rounded-[16px] shadow-xl border border-[#E5E7EB] p-16 text-center">
                <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                </div>
                <p className="text-[#111827] font-semibold text-lg mb-2">No content available</p>
                <p className="text-sm text-[#6B7280] max-w-md mx-auto">
                  There are no relevant course materials for this question yet. Upload course materials to get contextual help.
                </p>
              </div>
            )}

            {/* Content Display - ORGANIZED & USEFUL */}
            {!isLoading && !error && currentDoc && (
              <div className="space-y-4">
                {/* Document Header - Clear Source Info */}
                <div className="bg-white rounded-[16px] shadow-lg border border-[#E5E7EB] px-8 py-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[12px] flex items-center justify-center flex-shrink-0 shadow-lg">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-[#111827]">
                          {currentDoc.title}
                        </h3>
                        {currentDoc.maxSimilarity > 0 && (
                          <span className="px-2.5 py-1 bg-[#D1FAE5] text-[#065F46] rounded-full text-xs font-medium flex items-center gap-1.5 flex-shrink-0">
                            <Target className="w-3 h-3" />
                            {(currentDoc.maxSimilarity * 100).toFixed(0)}% relevant
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          {formatDocType(currentDoc.docType)}
                        </span>
                        {currentDoc.pageNumbers.length > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              {currentDoc.pageNumbers.length === 1 
                                ? `Page ${currentDoc.pageNumbers[0]}`
                                : `Pages ${currentDoc.pageNumbers[0]}-${currentDoc.pageNumbers[currentDoc.pageNumbers.length - 1]}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Structured Explanation - Like Khan Academy */}
                <div className="bg-white rounded-[16px] shadow-lg border border-[#E5E7EB] overflow-hidden">
                  <div className="px-8 py-6 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-[#4F46E5]" />
                      <h4 className="font-semibold text-[#111827]">Explanation & Context</h4>
                    </div>
                  </div>
                  
                  <div className="px-8 py-6">
                    {(() => {
                      // Get the primary chunk (most relevant)
                      const primaryChunk = currentDoc.chunks[0]
                      
                      // Show context paragraphs if available (paragraph-level retrieval)
                      const hasContext = primaryChunk?.paragraph_before || primaryChunk?.paragraph_after
                      
                      // Combine all chunks and structure them properly
                      const allContent = currentDoc.chunks
                        .map(chunk => formatContentUseful(chunk.content))
                        .join('\n\n')
                        .split(/\n\n+/)
                        .filter(p => p.trim().length > 20) // Only meaningful paragraphs
                      
                      // Structure the content into sections
                      const structured = structureContent(allContent)
                      
                      return (
                        <div className="space-y-6">
                          {/* Context Before (if paragraph-level retrieval) */}
                          {primaryChunk?.paragraph_before && (
                            <section className="space-y-2">
                              <div className="bg-[#F3F4F6] rounded-[10px] p-4 border-l-2 border-[#D1D5DB]">
                                <p className="text-[#6B7280] leading-relaxed text-[14px] italic">
                                  {formatContentUseful(primaryChunk.paragraph_before)}
                                </p>
                              </div>
                            </section>
                          )}
                          
                          {/* Main Explanation */}
                          {structured.mainExplanation && (
                            <section className="space-y-4">
                              <h5 className="text-base font-semibold text-[#111827] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-[#4F46E5] rounded-full"></div>
                                Explanation
                              </h5>
                              <div className="bg-[#F9FAFB] rounded-[10px] p-5 border-2 border-[#4F46E5]">
                                <p className="text-[#374151] leading-relaxed text-[15px]">
                                  {structured.mainExplanation}
                                </p>
                              </div>
                            </section>
                          )}
                          
                          {/* Context After (if paragraph-level retrieval) */}
                          {primaryChunk?.paragraph_after && (
                            <section className="space-y-2">
                              <div className="bg-[#F3F4F6] rounded-[10px] p-4 border-l-2 border-[#D1D5DB]">
                                <p className="text-[#6B7280] leading-relaxed text-[14px] italic">
                                  {formatContentUseful(primaryChunk.paragraph_after)}
                                </p>
                              </div>
                            </section>
                          )}
                          
                          {/* Key Concepts */}
                          {structured.keyConcepts.length > 0 && (
                            <section className="space-y-4">
                              <h5 className="text-base font-semibold text-[#111827] flex items-center gap-2">
                                <Target className="w-4 h-4 text-[#4F46E5]" />
                                Key Concepts
                              </h5>
                              <div className="space-y-3">
                                {structured.keyConcepts.map((concept, idx) => (
                                  <div key={idx} className="bg-white border-l-4 border-[#4F46E5] pl-4 py-3 pr-4 rounded-r-[8px] shadow-sm">
                                    <p className="text-[#111827] font-medium text-[15px] leading-relaxed">
                                      {concept}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}
                          
                          {/* Details & Examples */}
                          {structured.details.length > 0 && (
                            <section className="space-y-4">
                              <h5 className="text-base font-semibold text-[#111827] flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                                Details
                              </h5>
                              <div className="space-y-3">
                                {structured.details.map((detail, idx) => (
                                  <div key={idx} className="bg-[#F9FAFB] rounded-[8px] p-4">
                                    <p className="text-[#374151] leading-relaxed text-[15px]">
                                      {detail}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}
                          
                          {/* Additional Context */}
                          {structured.additional.length > 0 && (
                            <section className="space-y-3">
                              {structured.additional.map((item, idx) => (
                                <div key={idx} className="bg-white/50 rounded-[8px] p-4 border border-[#E5E7EB]">
                                  <p className="text-[#6B7280] leading-relaxed text-[14px]">
                                    {item}
                                  </p>
                                </div>
                              ))}
                            </section>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  
                  {/* Source Info Footer */}
                  <div className="px-8 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between text-xs text-[#6B7280]">
                    <span>
                      {currentDoc.chunks.length} {currentDoc.chunks.length === 1 ? 'excerpt' : 'excerpts'} from this document
                    </span>
                    {currentDoc.maxSimilarity > 0 && (
                      <span className="font-medium">
                        {(currentDoc.maxSimilarity * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Production Grade */}
        <div className="px-8 py-5 border-t border-[#E5E7EB] bg-gradient-to-r from-[#F9FAFB] to-white flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4F46E5]" />
            <p className="text-sm font-medium text-[#6B7280]">
              Reference these materials while working on problems
            </p>
          </div>
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

// Helper to format content in a USEFUL way - clean, readable, organized
function formatContentUseful(content: string): string {
  if (!content) return ''
  
  // Clean up content - remove excessive whitespace but keep structure
  let formatted = content
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines for readability
    .replace(/[ \t]{2,}/g, ' ') // Collapse multiple spaces
    .trim()
  
  // Remove markdown headers (##, ###, etc.) - user doesn't want them
  formatted = formatted.replace(/^#{1,6}\s+/gm, '')
  
  // Clean up markdown formatting but keep the content
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold markers
  formatted = formatted.replace(/\*(.+?)\*/g, '$1') // Remove italic markers
  formatted = formatted.replace(/`(.+?)`/g, '$1') // Remove inline code markers
  formatted = formatted.replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
  
  // Clean up list markers but keep structure
  formatted = formatted.replace(/^[-•*]\s+/gm, '• ')
  formatted = formatted.replace(/^\d+\.\s+/gm, '')
  
  // Remove code blocks but keep content
  formatted = formatted.replace(/```[\s\S]*?```/g, '')
  
  // Remove blockquotes markers
  formatted = formatted.replace(/^>\s+/gm, '')
  
  // Fix sentence breaks - ensure proper spacing
  formatted = formatted.replace(/([.!?])([A-Z])/g, '$1 $2')
  
  // Final cleanup
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/^\s+/gm, '') // Remove leading whitespace from lines
    .trim()
  
  return formatted
}

// Structure content into useful sections - like Khan Academy explanations
function structureContent(paragraphs: string[]): {
  mainExplanation: string | null
  keyConcepts: string[]
  details: string[]
  additional: string[]
} {
  const result = {
    mainExplanation: null as string | null,
    keyConcepts: [] as string[],
    details: [] as string[],
    additional: [] as string[]
  }
  
  paragraphs.forEach(para => {
    const formatted = formatParagraph(para)
    if (!formatted || formatted.length < 20) return
    
    // Main explanation - longest, most comprehensive paragraph
    if (!result.mainExplanation && formatted.length > 100) {
      result.mainExplanation = formatted
      return
    }
    
    // Key concepts - short, important statements (definitions, key points)
    if (formatted.length < 150 && (
      formatted.includes(':') && formatted.split(':')[0].length < 60 ||
      /^(?:[A-Z][^.!?]{0,80})\s+(?:is|refers to|means|denotes|are|represents)/i.test(formatted) ||
      formatted.match(/^[A-Z][^.!?]{0,120}[.!?]$/)
    )) {
      result.keyConcepts.push(formatted)
      return
    }
    
    // Details - medium length explanations
    if (formatted.length >= 100 && formatted.length < 300) {
      result.details.push(formatted)
      return
    }
    
    // Additional context - everything else
    result.additional.push(formatted)
  })
  
  // If no main explanation found, use the longest detail
  if (!result.mainExplanation && result.details.length > 0) {
    result.mainExplanation = result.details.shift() || null
  }
  
  // Limit key concepts to most important
  result.keyConcepts = result.keyConcepts.slice(0, 5)
  
  return result
}

// Format individual paragraph for PROPER USER-FRIENDLY formatting
function formatParagraph(text: string): string {
  if (!text) return ''
  
  // Clean up the text
  let formatted = text.trim()
  
  // Remove any remaining markdown artifacts
  formatted = formatted.replace(/^[-•*]\s*/, '') // Remove list markers at start
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
  formatted = formatted.replace(/\*(.+?)\*/g, '$1') // Remove italic
  formatted = formatted.replace(/`(.+?)`/g, '$1') // Remove code
  formatted = formatted.replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
  
  // Ensure proper spacing after punctuation
  formatted = formatted.replace(/([.!?])([A-Za-z])/g, '$1 $2')
  
  // Fix spacing around punctuation
  formatted = formatted.replace(/\s+([,;:])/g, '$1')
  formatted = formatted.replace(/([,;:])([A-Za-z])/g, '$1 $2')
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2') // Space before capital letters
  
  // Clean up multiple spaces
  formatted = formatted.replace(/\s{2,}/g, ' ')
  
  // Ensure sentence capitalization
  formatted = formatted.replace(/^([a-z])/, (match, letter) => letter.toUpperCase())
  
  // Ensure proper ending punctuation
  if (!/[.!?]$/.test(formatted.trim())) {
    formatted = formatted.trim() + '.'
  }
  
  return formatted.trim()
}

export default RelevantContentViewer



