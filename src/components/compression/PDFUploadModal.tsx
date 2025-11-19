import { useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';

interface PDFUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
}

export function PDFUploadModal({ isOpen, onClose, onUpload }: PDFUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-[20px] max-w-2xl w-full p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl mb-2">Upload Course Materials</h2>
              <p className="text-[#6B7280]">
                Upload PDFs, lecture notes, or textbook chapters to generate AI compressions
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F9FAFB] rounded-[8px] transition-colors"
            >
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-[16px] p-12 text-center transition-all ${
              dragActive
                ? 'border-[#4F46E5] bg-[#F5F3FF]'
                : 'border-[#E5E7EB] hover:border-[#4F46E5]'
            }`}
          >
            <div className="w-16 h-16 rounded-[16px] bg-[#F5F3FF] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-[#4F46E5]" />
            </div>
            <h3 className="text-xl mb-2">Drop PDFs here</h3>
            <p className="text-[#6B7280] mb-4">or click to browse your files</p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
            >
              Browse Files
            </label>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <div className="text-sm text-[#6B7280] mb-3">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-[10px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[8px] bg-[#FEE2E2] flex items-center justify-center">
                        <File className="w-5 h-5 text-[#EF4444]" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{file.name}</div>
                        <div className="text-xs text-[#6B7280]">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-white rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-[#E5E7EB] rounded-[12px] font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0}
              className="flex-1 px-6 py-3 bg-[#10B981] text-white rounded-[12px] font-medium hover:bg-[#059669] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Generate Compressions
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
