import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error. Please try again.',
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-[16px] bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-[#EF4444]" />
        </div>
        <h3 className="text-2xl mb-2">{title}</h3>
        <p className="text-[#6B7280] mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-[12px] font-medium hover:bg-[#4338CA] transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
