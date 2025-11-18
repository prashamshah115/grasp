import { FileText, X } from 'lucide-react';

interface SourceSnippetProps {
  show: boolean;
  onClose: () => void;
  source: string;
  reference: string;
}

export function SourceSnippet({ show, onClose, source, reference }: SourceSnippetProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-[12px] md:rounded-[12px] max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#4F46E5]" />
            <h3>Source Material</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <p className="text-xs text-[#6B7280] mb-3">{reference}</p>
          <div className="bg-[#F9FAFB] rounded-[12px] p-4 border border-[#E5E7EB]">
            <p className="text-sm whitespace-pre-wrap">{source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
