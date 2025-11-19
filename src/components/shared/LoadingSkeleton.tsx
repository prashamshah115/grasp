interface LoadingSkeletonProps {
  type?: 'card' | 'text' | 'circle' | 'list';
  count?: number;
}

export function LoadingSkeleton({ type = 'card', count = 1 }: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 animate-pulse">
            <div className="h-4 bg-[#F3F4F6] rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-[#F3F4F6] rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-[#F3F4F6] rounded w-full mb-2"></div>
            <div className="h-4 bg-[#F3F4F6] rounded w-5/6"></div>
          </div>
        );
      
      case 'text':
        return (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[#F3F4F6] rounded w-full"></div>
            <div className="h-4 bg-[#F3F4F6] rounded w-5/6"></div>
            <div className="h-4 bg-[#F3F4F6] rounded w-4/6"></div>
          </div>
        );
      
      case 'circle':
        return (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-[#F3F4F6] rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-[#F3F4F6] rounded w-1/2"></div>
            </div>
          </div>
        );
      
      case 'list':
        return (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#F3F4F6] rounded"></div>
                <div className="flex-1 h-4 bg-[#F3F4F6] rounded"></div>
              </div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}
