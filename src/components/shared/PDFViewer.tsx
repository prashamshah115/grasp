/**
 * PDFViewer Component
 *
 * A reusable PDF viewer with controls for navigation, zoom, and page selection
 * Supports viewing PDFs from public URLs (Supabase storage)
 * Can jump to specific pages
 *
 * Usage:
 * <PDFViewer
 *   url="https://storage.supabase.com/..."
 *   initialPage={5}
 *   documentTitle="Chapter 3 - Operating Systems"
 * />
 */

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X, Loader2 } from 'lucide-react'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  url: string
  initialPage?: number
  documentTitle?: string
  onClose?: () => void
  className?: string
}

export function PDFViewer({
  url,
  initialPage = 1,
  documentTitle,
  onClose,
  className = ''
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reset page number when initial page changes
  useEffect(() => {
    setPageNumber(initialPage)
  }, [initialPage])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setError(null)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF. Please try again.')
    setIsLoading(false)
  }

  const handlePreviousPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev))
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.0))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
  }

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1 && value <= (numPages || 1)) {
      setPageNumber(value)
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = documentTitle || 'document.pdf'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={`flex flex-col h-full bg-[#1F2937] ${className}`}>
      {/* Header / Controls */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#374151] border-b border-[#4B5563]">
        <div className="flex items-center gap-4">
          {documentTitle && (
            <h3 className="text-white font-medium truncate max-w-md">
              {documentTitle}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={pageNumber <= 1 || isLoading}
              className="p-2 text-white hover:bg-[#4B5563] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-white text-sm">
              <input
                type="number"
                min={1}
                max={numPages || 1}
                value={pageNumber}
                onChange={handlePageInput}
                className="w-14 px-2 py-1 bg-[#1F2937] border border-[#4B5563] rounded text-center focus:outline-none focus:border-[#4F46E5]"
              />
              <span>/ {numPages || '?'}</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={pageNumber >= (numPages || 1) || isLoading}
              className="p-2 text-white hover:bg-[#4B5563] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="w-px h-6 bg-[#4B5563]" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5 || isLoading}
              className="p-2 text-white hover:bg-[#4B5563] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <span className="text-white text-sm w-12 text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 2.0 || isLoading}
              className="p-2 text-white hover:bg-[#4B5563] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>

          <div className="w-px h-6 bg-[#4B5563]" />

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 text-white hover:bg-[#4B5563] rounded-lg transition-colors"
            title="Download PDF"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Close Button */}
          {onClose && (
            <>
              <div className="w-px h-6 bg-[#4B5563]" />
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-[#4B5563] rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-[#1F2937] flex items-start justify-center p-8">
        {error ? (
          <div className="bg-[#FEE2E2] border border-[#EF4444] rounded-lg p-6 max-w-md">
            <h4 className="text-[#EF4444] font-medium mb-2">Error Loading PDF</h4>
            <p className="text-[#991B1B] text-sm">{error}</p>
          </div>
        ) : (
          <div className="bg-white shadow-2xl">
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-12">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
                    <p className="text-[#6B7280]">Loading PDF...</p>
                  </div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                loading={
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />
                  </div>
                }
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * PDFViewerModal Component
 *
 * A modal wrapper for the PDF viewer
 * Useful for overlay/popup contexts
 */

interface PDFViewerModalProps extends PDFViewerProps {
  isOpen: boolean
}

export function PDFViewerModal({ isOpen, onClose, ...props }: PDFViewerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full h-full max-w-7xl max-h-screen m-8 bg-[#1F2937] rounded-lg overflow-hidden shadow-2xl">
        <PDFViewer {...props} onClose={onClose} className="h-full" />
      </div>
    </div>
  )
}
