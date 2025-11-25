/**
 * Task Compressor Component
 * 
 * "I have X minutes - what should I do?"
 * 
 * Generates optimized study sequences based on:
 * - Available time
 * - Topic mastery
 * - Recent activity
 * - Days until final
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
  RefreshCw,
  Sparkles,
  RotateCw
} from 'lucide-react';
import { useWeakTopics, useRecentTasks, useRecordTask, type FinalsDashboardData } from '@/hooks/useFinals';
import { 
  compressTasks, 
  getTotalDuration,
  type StudyTask,
  type TaskType
} from '@/lib/task-compression';

interface TaskCompressorProps {
  courseId: string;
  courseData?: FinalsDashboardData;
}

const TASK_ICONS: Record<TaskType, React.ComponentType<{ className?: string }>> = {
  weak_topic_drill: Zap,
  mini_mock: FileText,
  mixed_recall: Brain,
  concept_sheet: BookOpen,
  formula_recall: Zap,
  flashcard: RotateCw,
};

// Premium color scheme matching sample code
const TASK_STYLES: Record<TaskType, { bg: string; hover: string; text: string }> = {
  weak_topic_drill: { bg: 'bg-[#FEF3C7]', hover: 'group-hover:bg-[#FDE68A]', text: 'text-[#F59E0B]' },
  mini_mock: { bg: 'bg-[#F5F3FF]', hover: 'group-hover:bg-[#EEF2FF]', text: 'text-[#4F46E5]' },
  mixed_recall: { bg: 'bg-[#DBEAFE]', hover: 'group-hover:bg-[#BFDBFE]', text: 'text-[#3B82F6]' },
  concept_sheet: { bg: 'bg-[#D1FAE5]', hover: 'group-hover:bg-[#A7F3D0]', text: 'text-[#10B981]' },
  formula_recall: { bg: 'bg-[#FEF3C7]', hover: 'group-hover:bg-[#FDE68A]', text: 'text-[#F59E0B]' },
  flashcard: { bg: 'bg-[#F3F4F6]', hover: 'group-hover:bg-[#E5E7EB]', text: 'text-[#6B7280]' },
};

const TIME_OPTIONS = [
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '90 min' },
];

export function TaskCompressor({ courseId, courseData }: TaskCompressorProps) {
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
      daysUntilFinal: courseData?.days_until_final ?? undefined,
    });
  }, [timeBudget, courseId, weakTopics, recentTasks, courseData?.days_until_final, topicsLoading]);

  const totalDuration = getTotalDuration(compressedTasks);

  const handleStartTask = (task: StudyTask) => {
    // Record the task start
    recordTask({
      courseId,
      taskType: task.task_type,
      topicId: task.topic_id,
      durationMinutes: task.duration_minutes,
    });

    // Navigate to the task
    navigate(task.route);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    // Simulate regeneration (the memoized value will update automatically)
    setTimeout(() => setIsGenerating(false), 300);
  };

  const handleStartSession = () => {
    if (compressedTasks.length > 0) {
      handleStartTask(compressedTasks[0]);
    }
  };

  const isLoading = topicsLoading || tasksLoading;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFA] to-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl tracking-tight">Smart Study Plan</h3>
            <p className="text-xs text-[#9CA3AF]">AI-optimized for {courseData?.course_code || 'your course'}</p>
          </div>
        </div>
      </div>

      {/* Time Selector */}
      <div className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#9CA3AF]" />
          <span className="text-sm text-[#6B7280]">I have time for:</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeBudget(option.value)}
              className={`px-3 py-2.5 rounded-[10px] text-sm transition-all duration-200 ${
                timeBudget === option.value
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Study Tasks List */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[#4F46E5] animate-spin" />
            <p className="text-[#6B7280]">Generating study plan...</p>
          </div>
        ) : compressedTasks.length > 0 ? (
          <>
            {/* Summary Row */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B7280]">{compressedTasks.length} tasks</span>
                <span className="text-sm text-[#9CA3AF]">•</span>
                <span className="text-sm text-[#6B7280]">{totalDuration} min total</span>
              </div>
              <button 
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex items-center gap-1.5 text-sm text-[#4F46E5] hover:text-[#4338CA] transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Task Cards */}
            <div className="space-y-2">
              {compressedTasks.map((task, index) => {
                const Icon = TASK_ICONS[task.task_type];
                const styles = TASK_STYLES[task.task_type];
                
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-4 p-4 bg-[#FAFAFA] hover:bg-[#F5F5F5] rounded-[12px] transition-all duration-200 cursor-pointer"
                    onClick={() => handleStartTask(task)}
                  >
                    {/* Task Number & Icon */}
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs text-[#9CA3AF] flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className={`w-10 h-10 rounded-[10px] ${styles.bg} ${styles.hover} flex items-center justify-center transition-colors flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${styles.text}`} />
                      </div>
                    </div>

                    {/* Task Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm truncate">{task.description}</p>
                        <span className="text-xs text-[#9CA3AF]">•</span>
                        <span className="text-xs text-[#9CA3AF]">{task.duration_minutes} min</span>
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">{task.topic_name || 'General'}</p>
                    </div>

                    {/* Start Button */}
                    <button 
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#4F46E5] text-[#6B7280] hover:text-white rounded-[8px] transition-all duration-200 text-xs shadow-sm flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartTask(task);
                      }}
                    >
                      <Play className="w-3 h-3" />
                      <span>Start</span>
                    </button>

                    {/* Chevron */}
                    <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-[16px] bg-[#F5F3FF] flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-[#4F46E5] opacity-50" />
            </div>
            <p className="text-[#111827] mb-2">No tasks available</p>
            <p className="text-sm text-[#6B7280]">
              Complete some practice questions first to generate personalized recommendations.
            </p>
          </div>
        )}
      </div>

      {/* Footer - Start Session Button */}
      {compressedTasks.length > 0 && (
        <div className="px-8 py-6 border-t border-[#E5E7EB] bg-gradient-to-br from-white to-[#FAFAFA]">
          <button
            onClick={handleStartSession}
            className="w-full bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] text-white px-6 py-4 rounded-[12px] transition-all duration-300 shadow-md hover:shadow-lg group flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Start Full Study Session</span>
            <span className="text-sm text-white/80">({totalDuration} min)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default TaskCompressor;
