import { ReactNode } from 'react';

interface EmptyStateCtaCardProps {
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  icon?: ReactNode;
}

export function EmptyStateCtaCard({
  title,
  description,
  ctaLabel,
  onClick,
  icon,
}: EmptyStateCtaCardProps) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] h-full min-h-[220px] flex flex-col items-center justify-center text-center px-8 py-6">
      {icon && <div className="mb-3">{icon}</div>}
      <h3 className="text-lg font-semibold text-[#111827] mb-2">{title}</h3>
      <p className="text-sm text-[#6B7280] mb-4 max-w-sm">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center px-4 py-2.5 rounded-[10px] bg-[#4F46E5] text-white text-sm font-medium shadow-sm hover:bg-[#4338CA] transition-colors"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default EmptyStateCtaCard;


