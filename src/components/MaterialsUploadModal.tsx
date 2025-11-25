import { useState, useRef, DragEvent } from 'react';
import { Upload, X, File, FileText, FileImage, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useUploadCourseMaterial } from '@/hooks/useUserCourses';

interface MaterialsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
}

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

export function MaterialsUploadModal({ isOpen, onClose, courseId, courseName }: MaterialsUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadCourseMaterial();

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    // Filter to only PDFs and images
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '');
    });

    const newFiles: UploadedFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'uploading',
      progress: 0,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    
    // Upload files sequentially
    newFiles.forEach((uploadedFile) => {
      uploadFile(uploadedFile);
    });
  };

  const uploadFile = async (uploadedFile: UploadedFile) => {
    try {
      // Update progress to show upload started
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, progress: 10, status: 'uploading' }
            : f
        )
      );

      // Upload the file
      await uploadMutation.mutateAsync({
        file: uploadedFile.file,
        courseId,
      });

      // Mark as complete
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, progress: 100, status: 'complete' }
            : f
        )
      );
    } catch (error: any) {
      // Mark as error
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, status: 'error', error: error.message || 'Upload failed' }
            : f
        )
      );
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) {
      return <FileImage className="w-5 h-5 text-[#4F46E5]" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-[#4F46E5]" />;
    }
    return <File className="w-5 h-5 text-[#4F46E5]" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDone = () => {
    // Only close if all files are complete or there are no files
    const hasUploading = uploadedFiles.some(f => f.status === 'uploading');
    if (!hasUploading) {
      setUploadedFiles([]);
      onClose();
    }
  };

  const allComplete = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'complete' || f.status === 'error');
  const hasUploading = uploadedFiles.some(f => f.status === 'uploading');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl mb-1 tracking-tight">Upload Materials</h2>
              <p className="text-sm text-[#6B7280]">Add course materials for {courseName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-[#9CA3AF] hover:text-[#111827] transition-colors p-2 hover:bg-[#F9FAFB] rounded-[10px]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[12px] p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-[#4F46E5] bg-[#F5F3FF]'
                : 'border-[#E5E7EB] hover:border-[#4F46E5] hover:bg-[#FAFAFA]'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                isDragging ? 'bg-[#4F46E5]' : 'bg-[#F5F3FF]'
              }`}>
                <Upload className={`w-6 h-6 ${isDragging ? 'text-white' : 'text-[#4F46E5]'}`} />
              </div>
              <h3 className="text-base mb-1 tracking-tight">
                {isDragging ? 'Drop files here' : 'Drop files or click to browse'}
              </h3>
              <p className="text-xs text-[#6B7280]">
                PDFs, lecture slides, notes, and images
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.svg"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm text-[#9CA3AF] mb-4">Uploaded Files</h3>
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center gap-4 p-4 bg-[#F9FAFB] rounded-[12px] group hover:bg-[#F3F4F6] transition-colors"
                >
                  {/* File Icon */}
                  <div className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center flex-shrink-0">
                    {getFileIcon(uploadedFile.file.name)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm truncate">{uploadedFile.file.name}</p>
                      {uploadedFile.status === 'complete' && (
                        <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      )}
                      {uploadedFile.status === 'uploading' && (
                        <Loader2 className="w-4 h-4 text-[#4F46E5] animate-spin flex-shrink-0" />
                      )}
                      {uploadedFile.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {uploadedFile.status === 'uploading' && (
                      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F46E5] transition-all duration-300"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    )}
                    
                    {uploadedFile.status === 'complete' && (
                      <p className="text-xs text-[#9CA3AF]">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                    )}

                    {uploadedFile.status === 'error' && (
                      <p className="text-xs text-[#EF4444]">
                        {uploadedFile.error || 'Upload failed'}
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(uploadedFile.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#EF4444] transition-all p-2 hover:bg-white rounded-[8px]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-between">
          <p className="text-xs text-[#6B7280]">
            {uploadedFiles.length > 0 
              ? `${uploadedFiles.filter(f => f.status === 'complete').length} of ${uploadedFiles.length} uploaded`
              : 'No files uploaded yet'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#6B7280] hover:text-[#111827] transition-colors rounded-[8px] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              disabled={uploadedFiles.length === 0 || hasUploading}
              className="px-4 py-2 text-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-[8px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

