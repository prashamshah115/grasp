import { Sparkles } from 'lucide-react';

interface AIExplanationBubbleProps {
  message: string;
  onClose?: () => void;
}

export function AIExplanationBubble({ message, onClose }: AIExplanationBubbleProps) {
  return (
    <div className="bg-gradient-to-r from-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE] rounded-[16px] p-6">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-[#6B7280] mb-2 font-medium">AI Explanation</div>
          <div className="text-[#374151] leading-relaxed whitespace-pre-wrap">
            {message}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium transition-colors"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
