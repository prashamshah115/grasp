import { useState } from 'react'
import { File, Trash2, Download, Loader2, AlertCircle } from 'lucide-react'
import { useUserFiles, useDeleteUserFile, useUserFileUrl } from '@/hooks'
import { useAuth } from '@/components/auth/AuthProvider'

export function FileManagement() {
  const { user } = useAuth()
  const { data: files, isLoading, error } = useUserFiles()
  const deleteFile = useDeleteUserFile()
  const [deletingFile, setDeletingFile] = useState<string | null>(null)

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return

    setDeletingFile(filename)
    try {
      await deleteFile.mutateAsync(filename)
    } finally {
      setDeletingFile(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6B7280]">Please sign in to view your files</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#FEE2E2] border border-[#EF4444] rounded-[12px] p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-[#EF4444] mb-1">Error loading files</h3>
          <p className="text-sm text-[#991B1B]">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-[16px] bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
          <File className="w-8 h-8 text-[#9CA3AF]" />
        </div>
        <h3 className="text-xl mb-2">No files uploaded yet</h3>
        <p className="text-[#6B7280]">
          Upload your first PDF to get started with AI-powered study notes
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-medium">
          Your Files ({files.length})
        </h3>
      </div>

      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.name}
            className="flex items-center justify-between p-4 bg-white border border-[#E5E7EB] rounded-[12px] hover:border-[#4F46E5] transition-colors"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-[10px] bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
                <File className="w-6 h-6 text-[#EF4444]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate mb-1">
                  {file.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                  {file.metadata?.size && (
                    <span>{formatFileSize(file.metadata.size)}</span>
                  )}
                  {file.created_at && (
                    <>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(file.name)}
                disabled={deletingFile === file.name}
                className="p-2 hover:bg-[#FEE2E2] rounded-[8px] transition-colors disabled:opacity-50"
                title="Delete file"
              >
                {deletingFile === file.name ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#EF4444]" />
                ) : (
                  <Trash2 className="w-4 h-4 text-[#EF4444]" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
