/**
 * CompressionView Component - PHASE 4 INTEGRATED
 * AI-generated compression notes viewer
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useParams() to get courseId from URL
 * - Uses useCourse() hook for course data (React Query)
 * - Uses useTopics() hook for topics list (React Query)
 * - Uses useCompressionNotes() hook for notes (React Query)
 * - Uses useGenerateCompression() mutation to generate notes
 * - NO mock data, NO props
 */

import { FileText, Sparkles, Upload, Download, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCourse, useTopics, useCompressionNotes, useGenerateCompression } from '@/hooks'
import { useAppStore } from '@/lib/store'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'
import { PDFUploadModal } from './PDFUploadModal'
import { FileManagement } from '../storage/FileManagement'

export function CompressionView() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAppStore()
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [showFileManager, setShowFileManager] = useState(false)

  // Fetch course and topics
  const { data: course, isLoading: courseLoading } = useCourse(courseId!)
  const { data: topics, isLoading: topicsLoading } = useTopics(courseId!)

  // Fetch compression notes for selected topic
  const { data: notes, isLoading: notesLoading } = useCompressionNotes(
    user?.id || '',
    selectedTopicId || '',
    {
      enabled: !!selectedTopicId && !!user?.id,
    }
  )

  // Generate compression mutation
  const generateCompression = useGenerateCompression()

  const isLoading = courseLoading || topicsLoading

  if (isLoading) {
    return <LoadingScreen message="Loading compression view..." />
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Course not found</p>
      </div>
    )
  }

  const selectedTopic = topics?.find((t) => t.id === selectedTopicId)

  const handleGenerate = async () => {
    if (!selectedTopicId || !user?.id) return

    try {
      await generateCompression.mutateAsync({
        user_id: user.id,
        topic_id: selectedTopicId,
      })
    } catch (error) {
      console.error('Failed to generate compression:', error)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Topics List - Left Pane */}
      <div className="w-80 border-r border-[#E5E7EB] bg-[#FAFAFA] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-1">{course.code}</div>
              <h2 className="text-xl font-medium">Topics</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFileManager(!showFileManager)}
                className="p-2 hover:bg-white rounded-[8px] transition-colors"
                title="Manage files"
              >
                <FolderOpen className="w-4 h-4 text-[#6B7280]" />
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={!selectedTopicId}
                className="p-2 hover:bg-white rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedTopicId ? "Upload PDF" : "Select a topic first"}
              >
                <Upload className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>
          </div>

          {showFileManager ? (
            <FileManagement />
          ) : (
            <div className="space-y-2">
              {topics?.map((topic) => {
                // Check if this topic has notes (simple check - could be more robust)
                const hasNotes = false // TODO: Add hasNotes logic based on notes query

                return (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`w-full text-left p-4 rounded-[12px] transition-all ${
                      selectedTopicId === topic.id
                        ? 'bg-white border border-[#10B981] shadow-sm'
                        : 'bg-white border border-transparent hover:border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{topic.name}</div>
                      {hasNotes && (
                        <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                      )}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {hasNotes ? 'Compression ready' : 'No notes yet'}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes Viewer - Right Pane */}
      <div className="flex-1 overflow-y-auto bg-white">
        {selectedTopicId && selectedTopic ? (
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sm text-[#9CA3AF] mb-2">
                  AI-Generated Compression
                </div>
                <h1 className="text-4xl tracking-tight">{selectedTopic.name}</h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generateCompression.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:border-[#10B981] hover:text-[#10B981] transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">
                    {generateCompression.isPending ? 'Generating...' : 'Regenerate'}
                  </span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669] transition-all">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
              </div>
            </div>

            {/* Note Content */}
            {notesLoading ? (
              <div className="text-center py-12">
                <div className="text-gray-500">Loading notes...</div>
              </div>
            ) : notes ? (
              <div className="prose prose-lg max-w-none">
                <div className="whitespace-pre-wrap text-[#374151] leading-relaxed">
                  {notes.content_md}
                </div>
              </div>
            ) : (
              // No notes yet - show generate button
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-[16px] bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-[#10B981]" />
                </div>
                <h3 className="text-2xl mb-2">No Compression Notes Yet</h3>
                <p className="text-[#6B7280] mb-6">
                  Generate AI-powered study notes for this topic
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generateCompression.isPending}
                  className="px-6 py-3 bg-[#10B981] text-white rounded-[12px] hover:bg-[#059669] transition-all disabled:opacity-50"
                >
                  {generateCompression.isPending
                    ? 'Generating...'
                    : 'Generate Compression'}
                </button>
              </div>
            )}
          </div>
        ) : (
          // Empty State
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-[16px] bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-2xl mb-2">Select a Topic</h3>
              <p className="text-[#6B7280]">
                Choose a topic from the left to view AI-generated study notes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant */}
      <AIAssistant
        context={`Course: ${course.code} - Compression Mode - Topic: ${
          selectedTopic?.name || 'None selected'
        }`}
      />

      {/* Upload Modal */}
      {selectedTopicId && (
        <PDFUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          courseId={courseId!}
          topicId={selectedTopicId}
        />
      )}
    </div>
  )
}
