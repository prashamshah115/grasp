/**
 * Task Compressor Card Component
 * 
 * Wrapper for TaskCompressor that fits in the side-by-side dashboard layout
 * Uses the same clean white card design as the original TaskCompressor
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Play, 
  Zap, 
  Target,
  BookOpen,
  FileText,
  Brain,
  ChevronRight,
  Sparkles,
  RotateCw
} from 'lucide-react';
import { useWeakTopics, useRecentTasks, useRecordTask } from '@/hooks/useFinals';
import { 
  compressTasks, 
  getTotalDuration,
  type StudyTask,
  type TaskType
} from '@/lib/task-compression';

interface TaskCompressorCardProps {
  courseId: string;
  isCompact?: boolean;
}

const TASK_ICONS: Record<TaskType, React.ComponentType<{ className?: string }>> = {
  weak_topic_drill: Zap,
  mini_mock: FileText,
  mixed_recall: Brain,
  concept_sheet: BookOpen,
  formula_recall: Zap,
  flashcard: RotateCw,
};

const TASK_STYLES: Record<TaskType, { bg: string; hover: string; text: string }> = {
  weak_topic_drill: { bg: 'bg-[#FEF3C7]', hover: 'group-hover:bg-[#FDE68A]', text: 'text-[#F59E0B]' },
  mini_mock: { bg: 'bg-[#F5F3FF]', hover: 'group-hover:bg-[#EEF2FF]', text: 'text-[#4F46E5]' },
  mixed_recall: { bg: 'bg-[#DBEAFE]', hover: 'group-hover:bg-[#BFDBFE]', text: 'text-[#3B82F6]' },
  concept_sheet: { bg: 'bg-[#D1FAE5]', hover: 'group-hover:bg-[#A7F3D0]', text: 'text-[#10B981]' },
  formula_recall: { bg: 'bg-[#FEF3C7]', hover: 'group-hover:bg-[#FDE68A]', text: 'text-[#F59E0B]' },
  flashcard: { bg: 'bg-[#F3F4F6]', hover: 'group-hover:bg-[#E5E7EB]', text: 'text-[#6B7280]' },
};

const TIME_OPTIONS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '1h' },
];

export function TaskCompressorCard({ courseId, isCompact = false }: TaskCompressorCardProps) {
  const navigate = useNavigate();
  const [timeBudget, setTimeBudget] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: weakTopics, isLoading: topicsLoading } = useWeakTopics(courseId);
  const { data: recentTasks, isLoading: tasksLoading } = useRecentTasks(courseId);
  const { mutate: recordTask } = useRecordTask();

  const compressedTasks = useMemo(() => {
    if (!weakTopics || topicsLoading) return [];

    return compressTasks({
      timeBudgetMinutes: timeBudget,
      courseId,
      topicMastery: weakTopics,
      recentTasks: recentTasks?.map(t => ({
        task_type: t.task_type as TaskType,
        topic_id: t.topic_id,
        completed_at: t.completed_at,
      })) || [],
    });
  }, [timeBudget, courseId, weakTopics, recentTasks, topicsLoading]);

  const totalDuration = getTotalDuration(compressedTasks);

  const handleStartTask = (task: StudyTask) => {
    recordTask({
      courseId,
      taskType: task.task_type,
      topicId: task.topic_id,
      durationMinutes: task.duration_minutes,
    });
    navigate(task.route);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 300);
  };

  const handleStartSession = () => {
    if (compressedTasks.length > 0) {
      handleStartTask(compressedTasks[0]);
    }
  };

  const isLoading = topicsLoading || tasksLoading;
  const displayTasks = isCompact ? compressedTasks.slice(0, 3) : compressedTasks.slice(0, 5);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] overflow-hidden h-full min-h-[280px] flex flex-col shadow-lg">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFA] to-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Smart Study Plan</h3>
            <p className="text-xs text-[#9CA3AF]">AI-optimized for you</p>
          </div>
        </div>

        {/* Time Selector */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#9CA3AF]" />
          <span className="text-sm text-[#6B7280]">I have:</span>
          <div className="flex gap-1.5 ml-1">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeBudget(option.value)}
                className={`px-3 py-1.5 rounded-[8px] text-sm transition-all ${
                  timeBudget === option.value
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 px-6 py-4 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center">
            <RotateCw className="w-6 h-6 mx-auto mb-2 text-[#10B981] animate-spin" />
            <p className="text-[#6B7280] text-sm">Generating study plan...</p>
          </div>
        ) : displayTasks.length > 0 ? (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B7280]">{compressedTasks.length} tasks</span>
                <span className="text-[#9CA3AF]">•</span>
                <span className="text-sm text-[#6B7280]">{totalDuration} min</span>
              </div>
              <button 
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex items-center gap-1 text-sm text-[#10B981] hover:text-[#059669] transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              {displayTasks.map((task, index) => {
                const Icon = TASK_ICONS[task.task_type];
                const styles = TASK_STYLES[task.task_type];
                
                return (
                  <button
                    key={task.id}
                    onClick={() => handleStartTask(task)}
                    className="w-full group flex items-center gap-3 p-3 bg-[#FAFAFA] hover:bg-[#F5F5F5] rounded-[12px] transition-all text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-xs text-[#9CA3AF] flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className={`w-9 h-9 rounded-[10px] ${styles.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${styles.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#111827] truncate">{task.description}</p>
                      <p className="text-xs text-[#6B7280] truncate">{task.topic_name || 'General'} • {task.duration_minutes}m</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Show more indicator */}
            {compressedTasks.length > displayTasks.length && (
              <p className="text-center text-[#9CA3AF] text-xs mt-3">
                +{compressedTasks.length - displayTasks.length} more tasks
              </p>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-[14px] bg-[#D1FAE5] flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-[#10B981]" />
            </div>
            <p className="text-[#111827] text-sm mb-1">No tasks available</p>
            <p className="text-[#6B7280] text-xs">Complete practice to get recommendations</p>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {compressedTasks.length > 0 && (
        <div className="px-6 py-4 border-t border-[#E5E7EB] bg-gradient-to-br from-white to-[#FAFAFA]">
          <button
            onClick={handleStartSession}
            className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white px-5 py-3 rounded-[12px] transition-all shadow-md hover:shadow-lg group flex items-center justify-center gap-2 font-medium"
          >
            <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Start Session</span>
            <span className="text-sm text-white/80">({totalDuration}m)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default TaskCompressorCard;
