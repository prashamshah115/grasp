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

import { FileText, Sparkles, Upload, Download, FolderOpen, FileIcon } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCourse, useTopics, useCompressionNotes, useGenerateCompression } from '@/hooks'
import { useAuth } from '@/components/auth/AuthProvider'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'
import { PDFUploadModal } from './PDFUploadModal'
import { FileManagement } from '../storage/FileManagement'
import { PDFViewerModal } from '../shared/PDFViewer'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function CompressionView() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user, isLoading: authLoading } = useAuth()
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [showFileManager, setShowFileManager] = useState(false)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string
    title: string
    page?: number
  } | null>(null)

  // Fetch course and topics - all hooks called unconditionally
  const { data: course, isLoading: courseLoading } = useCourse(courseId!)
  const { data: topics, isLoading: topicsLoading } = useTopics(courseId!)

  // Fetch compression notes for selected topic
  const { data: notes, isLoading: notesLoading } = useCompressionNotes(
    user?.id,
    selectedTopicId || undefined
  )

  // Fetch documents for selected topic to show in PDF viewer
  const { data: topicDocuments } = useQuery({
    queryKey: ['topicDocuments', selectedTopicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('topic_id', selectedTopicId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!selectedTopicId,
  })

  // Fetch all compression notes for this course to determine which topics have notes
  const { data: allNotes } = useQuery({
    queryKey: ['allCompressionNotes', courseId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compression_notes')
        .select('topic_id')
        .eq('user_id', user!.id)
        .in('topic_id', topics?.map(t => t.id) || [])

      if (error && error.code !== 'PGRST116') throw error
      return data || []
    },
    enabled: !!user?.id && !!topics && topics.length > 0,
  })

  // Generate compression mutation
  const generateCompression = useGenerateCompression()

  // Combine all loading states
  const isLoading = authLoading || courseLoading || topicsLoading

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
    if (!selectedTopicId || !user?.id) {
      console.error('Cannot generate compression: missing topicId or userId')
      return
    }

    try {
      const result = await generateCompression.mutateAsync({
        user_id: user.id,
        topic_id: selectedTopicId,
      })
      
      if (result && result.content) {
        // Success - query will be invalidated automatically by the mutation
        console.log('Compression generated successfully')
      }
    } catch (error: any) {
      console.error('Failed to generate compression:', error)
      
      // Show user-friendly error message based on error type
      let errorMsg = 'Failed to generate compression notes'
      
      if (error?.message) {
        if (error.message.includes('No documents found') || error.message.includes('404')) {
          errorMsg = 'No course materials found for this topic. Compression uses existing documents in the database - please upload course materials first or check if documents exist for this course.'
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMsg = 'Rate limit exceeded. Please wait a moment and try again.'
        } else if (error.message.includes('API') || error.message.includes('credits') || error.message.includes('quota')) {
          errorMsg = 'AI service temporarily unavailable. This may be due to API credits. Please try again later or contact support.'
        } else {
          errorMsg = error.message
        }
      }
      
      alert(`Error: ${errorMsg}`)
    }
  }

  const handleDownload = () => {
    if (!notes || !selectedTopic) return

    // Create markdown file content
    const content = `# ${selectedTopic.name}\n\nCourse: ${course.name} (${course.code})\n\n---\n\n${notes.content_md}`

    // Create blob and download
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${course.code}-${selectedTopic.name.replace(/[^a-z0-9]/gi, '-')}-compression-notes.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleOpenPdf = async (documentId: string, title: string, page?: number) => {
    // Get public URL for document
    const doc = topicDocuments?.find(d => d.id === documentId)
    if (!doc) return

    const { data } = supabase.storage
      .from('course-materials')
      .getPublicUrl(doc.storage_path)

    setSelectedPdf({
      url: data.publicUrl,
      title,
      page,
    })
    setPdfViewerOpen(true)
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
                // Check if this topic has compression notes
                const hasNotes = allNotes?.some(n => n.topic_id === topic.id) || false

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
                <button
                  onClick={handleDownload}
                  disabled={!notes}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
              </div>
            </div>

            {/* Source Materials */}
            {topicDocuments && topicDocuments.length > 0 && (
              <div className="mb-8 p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
                <h3 className="text-sm font-medium text-[#6B7280] mb-4">Source Materials</h3>
                <div className="space-y-2">
                  {topicDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleOpenPdf(doc.id, doc.title)}
                      className="w-full flex items-center gap-3 p-3 bg-white border border-[#E5E7EB] rounded-[10px] hover:border-[#4F46E5] hover:bg-[#F9FAFB] transition-all text-left"
                    >
                      <FileIcon className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#111827] truncate">
                          {doc.title}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          {doc.doc_type} • {doc.total_pages || '?'} pages
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
        courseId={courseId!}
        topicId={selectedTopicId || undefined}
        mode="compression"
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

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <PDFViewerModal
          isOpen={pdfViewerOpen}
          url={selectedPdf.url}
          documentTitle={selectedPdf.title}
          initialPage={selectedPdf.page || 1}
          onClose={() => {
            setPdfViewerOpen(false)
            setSelectedPdf(null)
          }}
        />
      )}
    </div>
  )
}
