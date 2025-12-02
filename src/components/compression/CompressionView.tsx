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
 * - Supports sidebar tabs: Topics | Finals Cheatsheet
 * - NO mock data, NO props
 */

import { FileText, Sparkles, Upload, Download, FolderOpen, FileIcon, Book, GraduationCap } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useCourse, useTopics, useCompressionNotes, useGenerateCompression } from '@/hooks'
import { useTriggerKSVUpdate } from '@/hooks/useKnowledgeState'
import { logger } from '@/lib/logger'
import { ErrorDisplay } from '@/components/errors/ErrorDisplay'
import { useAuth } from '@/components/auth/AuthProvider'
import LoadingScreen from '../LoadingScreen'
import { AIAssistant } from '../shared/AIAssistant'
import { PDFUploadModal } from './PDFUploadModal'
import { FileManagement } from '../storage/FileManagement'
import { PDFViewerModal } from '../shared/PDFViewer'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'

type SidebarTab = 'topics' | 'finals'

export function CompressionView() {
  const { courseId } = useParams<{ courseId: string }>()
  const [searchParams] = useSearchParams()
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
  
  // Sidebar tab state - read from URL param
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    tabFromUrl === 'finals' ? 'finals' : 'topics'
  )

  // Update tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === 'finals') {
      setActiveTab('finals')
    }
  }, [tabFromUrl])

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
      if (!user?.id || !topics || !Array.isArray(topics) || topics.length === 0) {
        return []
      }

      const topicIds = topics
        .filter(t => t && t.id)
        .map(t => t.id)
      
      if (topicIds.length === 0) {
        return []
      }

      const { data, error } = await supabase
        .from('compression_notes')
        .select('topic_id, content_md')
        .eq('user_id', user.id)
        .in('topic_id', topicIds)

      if (error && error.code !== 'PGRST116') throw error
      return data || []
    },
    enabled: !!user?.id && !!topics && Array.isArray(topics) && topics.length > 0,
  })

  // Aggregate all compression notes for Finals Cheatsheet
  const finalsCheatsheet = useMemo(() => {
    if (!allNotes || !topics) return null
    
    const notesWithTopics = allNotes
      .map(note => {
        const topic = topics.find(t => t.id === note.topic_id)
        return topic ? { topic, content: note.content_md } : null
      })
      .filter(Boolean) as Array<{ topic: { id: string; name: string }; content: string }>
    
    return notesWithTopics.length > 0 ? notesWithTopics : null
  }, [allNotes, topics])

  // Generate compression mutation
  const generateCompression = useGenerateCompression()
  const triggerKSVUpdate = useTriggerKSVUpdate()

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

  const selectedTopic = topics?.find((t) => t && t.id === selectedTopicId)
  const topicsWithNotes = (allNotes && Array.isArray(allNotes) ? allNotes.filter(n => n && n.topic_id) : []).length || 0

  const handleGenerate = async () => {
    if (!selectedTopicId) {
      alert('Please select a topic first')
      return
    }
    
    if (!user?.id) {
      alert('Please sign in to generate study materials')
      return
    }

    try {
      const result = await generateCompression.mutateAsync({
        user_id: user.id,
        topic_id: selectedTopicId,
      })
      
      // Trigger KSV update after generating compression notes (engagement tracking)
      if (courseId) {
        triggerKSVUpdate.mutate(courseId)
      }
      
      if (result && result.content) {
        // Success - query will be invalidated automatically by the mutation
        console.log('[CompressionView] Compression generated successfully')
      }
    } catch (error: any) {
      logger.error('Failed to generate compression', error, {
        component: 'CompressionView',
        userId: user?.id,
        topicId: selectedTopicId,
        courseId,
      })
      
      // Show user-friendly error message
      const errorMessage = error?.message || error?.context?.message || 'Failed to generate study materials. Please try again.'
      
      // Error is also displayed via ErrorDisplay component, but show alert as backup
      alert(`Failed to generate study materials: ${errorMessage}`)
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

  const handleDownloadFinalsCheatsheet = () => {
    if (!finalsCheatsheet || !Array.isArray(finalsCheatsheet) || finalsCheatsheet.length === 0) return

    // Create markdown content with all topics
    const content = `# Finals Cheatsheet - ${course.name} (${course.code})\n\n` +
      `Generated: ${new Date().toLocaleDateString()}\n\n---\n\n` +
      finalsCheatsheet
        .filter(item => item && item.topic && item.content)
        .map(item => 
          `## ${item.topic.name}\n\n${item.content}\n\n---\n`
        ).join('\n')

    // Create blob and download
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${course.code}-finals-cheatsheet.md`
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
      {/* Sidebar - Left Pane */}
      <div className="w-80 border-r border-[#E5E7EB] bg-[#FAFAFA] overflow-y-auto">
        <div className="p-6">
          {/* Course Info & Actions */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-1">{course.code}</div>
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
                disabled={!selectedTopicId && activeTab !== 'finals'}
                className="p-2 hover:bg-white rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedTopicId ? "Upload PDF" : "Select a topic first"}
              >
                <Upload className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="mb-6">
            <div className="inline-flex w-full bg-white border border-[#E5E7EB] p-1 rounded-[10px]">
              <button
                onClick={() => {
                  setActiveTab('topics')
                  setSelectedTopicId(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[8px] text-sm transition-all duration-200 ${
                  activeTab === 'topics'
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <Book className="w-4 h-4" />
                Topics
              </button>
              <button
                onClick={() => {
                  setActiveTab('finals')
                  setSelectedTopicId(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[8px] text-sm transition-all duration-200 ${
                  activeTab === 'finals'
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Finals
              </button>
            </div>
          </div>

          {showFileManager ? (
            <FileManagement />
          ) : activeTab === 'topics' ? (
            // Topics List
            <div className="space-y-2">
              {(topics && Array.isArray(topics) ? topics : []).map((topic) => {
                // Check if this topic has compression notes
                const hasNotes = allNotes?.some(n => n.topic_id === topic.id) || false

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedTopicId(topic.id)
                    }}
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
          ) : (
            // Finals Cheatsheet Sidebar
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="p-4 bg-white border border-[#E5E7EB] rounded-[12px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-[#D97706]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Finals Cheatsheet</h4>
                    <p className="text-xs text-[#9CA3AF]">Aggregated notes</p>
                  </div>
                </div>
                <div className="text-xs text-[#6B7280]">
                  {topicsWithNotes} of {topics?.length || 0} topics covered
                </div>
                {topicsWithNotes > 0 && (
                  <div className="mt-3 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#10B981] rounded-full transition-all"
                      style={{ width: `${(topicsWithNotes / (topics?.length || 1)) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Topics with notes */}
              {finalsCheatsheet && Array.isArray(finalsCheatsheet) && finalsCheatsheet.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#9CA3AF] px-1">Included topics:</p>
                  {finalsCheatsheet
                    .filter(item => item && item.topic && item.topic.id)
                    .map((item) => (
                      <div
                        key={item.topic.id}
                        className="p-3 bg-white border border-transparent hover:border-[#E5E7EB] rounded-[10px] transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                          <span className="text-sm">{item.topic.name}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Topics without notes */}
              {topics && Array.isArray(topics) && topics.length > topicsWithNotes && (
                <div className="space-y-2">
                  <p className="text-xs text-[#9CA3AF] px-1">Missing topics:</p>
                  {topics
                    .filter(t => t && t.id && !(allNotes && Array.isArray(allNotes) && allNotes.some(n => n && n.topic_id === t.id)))
                    .map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveTab('topics')
                          setSelectedTopicId(topic.id)
                        }}
                        className="w-full p-3 bg-white border border-dashed border-[#E5E7EB] hover:border-[#4F46E5] rounded-[10px] transition-all text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#D1D5DB]" />
                          <span className="text-sm text-[#6B7280]">{topic.name}</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Right Pane */}
      <div className="flex-1 overflow-y-auto bg-white">
        {activeTab === 'finals' ? (
          // Finals Cheatsheet View
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sm text-[#9CA3AF] mb-2">
                  AI-Aggregated Cheatsheet
                </div>
                <h1 className="text-4xl tracking-tight">Finals Cheatsheet</h1>
              </div>
              <button
                onClick={handleDownloadFinalsCheatsheet}
                disabled={!finalsCheatsheet}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Download All</span>
              </button>
            </div>

            {finalsCheatsheet && Array.isArray(finalsCheatsheet) && finalsCheatsheet.length > 0 ? (
              <div className="space-y-8">
                  {finalsCheatsheet
                    .filter(item => item && item.topic && item.topic.id && item.content)
                    .map((item, index) => (
                  <div key={item.topic.id} className="pb-8 border-b border-[#E5E7EB] last:border-0">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#F5F3FF] text-sm text-[#4F46E5] font-medium">
                        {index + 1}
                      </span>
                      <h2 className="text-2xl tracking-tight">{item.topic.name}</h2>
                    </div>
                    <div className="prose prose-lg max-w-none text-[#374151] leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeHighlight]}
                      >
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Empty state for Finals Cheatsheet
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-[16px] bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-[#D97706]" />
                </div>
                <h3 className="text-2xl mb-2">No Cheatsheet Yet</h3>
                <p className="text-[#6B7280] mb-6 max-w-md mx-auto">
                  Generate compression notes for your topics first. They'll automatically appear here as your Finals Cheatsheet.
                </p>
                <button
                  onClick={() => setActiveTab('topics')}
                  className="px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] hover:bg-[#4338CA] transition-all"
                >
                  Go to Topics
                </button>
              </div>
            )}
          </div>
        ) : selectedTopicId && selectedTopic ? (
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sm text-[#9CA3AF] mb-2">
                  AI-Generated Compression
                </div>
                <h1 className="text-4xl tracking-tight">{selectedTopic.name}</h1>
              </div>
              <div className="flex flex-col gap-3">
                {generateCompression.isError && (
                  <ErrorDisplay
                    error={generateCompression.error || new Error('Failed to generate compression')}
                    onRetry={handleGenerate}
                    onDismiss={() => generateCompression.reset()}
                    title="Generation Failed"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generateCompression.isPending || !selectedTopicId || !user?.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:border-[#10B981] hover:text-[#10B981] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">
                      {generateCompression.isPending ? 'Generating...' : notes ? 'Regenerate' : 'Generate'}
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
            </div>

            {/* Source Materials */}
            {topicDocuments && Array.isArray(topicDocuments) && topicDocuments.length > 0 && (
              <div className="mb-8 p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
                <h3 className="text-sm font-medium text-[#6B7280] mb-4">Source Materials</h3>
                <div className="space-y-2">
                  {topicDocuments
                    .filter(doc => doc && doc.id)
                    .map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleOpenPdf(doc.id, doc.title || 'Document')}
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
              <div className="prose prose-lg max-w-none text-[#374151] leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeHighlight]}
                >
                  {notes.content_md}
                </ReactMarkdown>
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
                {generateCompression.isError && (
                  <div className="mb-4">
                    <ErrorDisplay
                      error={generateCompression.error || new Error('Failed to generate compression')}
                      onRetry={handleGenerate}
                      title="Generation Failed"
                    />
                  </div>
                )}
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
        compressionNotes={notes?.content_md}
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
