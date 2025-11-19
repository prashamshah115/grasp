import { AlertCircle } from 'lucide-react';

interface WeakTopic {
  id: string;
  name: string;
  masteryPercentage: number;
  questionsAttempted: number;
}

interface WeakTopicPanelProps {
  weakTopics: WeakTopic[];
  onFocusTopic?: (topicId: string) => void;
}

export function WeakTopicPanel({ weakTopics, onFocusTopic }: WeakTopicPanelProps) {
  if (weakTopics.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-[12px] bg-[#D1FAE5] flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-[#10B981]" />
          </div>
          <div className="font-medium mb-1">No weak spots!</div>
          <div className="text-sm text-[#6B7280]">You're doing great across all topics</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-[#EF4444]" />
        <h3 className="font-medium">Focus Areas</h3>
      </div>
      
      <div className="space-y-3">
        {weakTopics.map((topic) => (
          <div
            key={topic.id}
            className="p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-[12px]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="font-medium mb-1">{topic.name}</div>
                <div className="text-xs text-[#6B7280]">
                  {topic.questionsAttempted} questions attempted
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-medium text-[#F59E0B]">
                  {topic.masteryPercentage}%
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-2 bg-[#FDE68A] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F59E0B] rounded-full transition-all"
                style={{ width: `${topic.masteryPercentage}%` }}
              />
            </div>

            {onFocusTopic && (
              <button
                onClick={() => onFocusTopic(topic.id)}
                className="mt-3 text-sm text-[#F59E0B] hover:text-[#D97706] font-medium transition-colors"
              >
                Practice this topic →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
