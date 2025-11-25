/**
 * Finals Section Component
 * 
 * Collapsible section with:
 * - Purple gradient header with course info
 * - Inline date picker for finals date
 * - Days until finals countdown
 * - Stats widgets (Topics, Mastery, Weak Topics) when collapsed
 * - Expandable FinalPackView with 3 tabs
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertCircle,
  BookOpen,
  Target,
  AlertTriangle
} from 'lucide-react';
import { FinalPackView } from './FinalPackView';
import { 
  useUserFinalPreferences, 
  useUpdateFinalPreferences,
  useFinalsDashboard
} from '@/hooks/useFinals';

interface FinalsSectionProps {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

// Stat widget component
function StatWidget({ 
  icon: Icon, 
  label, 
  value, 
  color = 'white' 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: 'white' | 'red' | 'yellow';
}) {
  const bgColors = {
    white: 'bg-white/20',
    red: 'bg-red-500/30',
    yellow: 'bg-yellow-500/30',
  };
  
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${bgColors[color]} backdrop-blur-sm rounded-[12px]`}>
      <div className="w-8 h-8 rounded-[8px] bg-white/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-white font-semibold text-lg leading-tight">{value}</p>
        <p className="text-white/70 text-xs">{label}</p>
      </div>
    </div>
  );
}

export function FinalsSection({ 
  courseId, 
  courseCode, 
  courseTitle,
  isExpanded: controlledExpanded,
  onExpandChange
}: FinalsSectionProps) {
  const navigate = useNavigate();
  
  // Use controlled or internal state
  const isExpanded = controlledExpanded ?? false;
  const setIsExpanded = onExpandChange ?? (() => {});
  
  // Fetch existing preferences
  const { data: preferences } = useUserFinalPreferences(courseId);
  const updatePreferences = useUpdateFinalPreferences();
  
  // Fetch dashboard stats
  const { data: dashboardData } = useFinalsDashboard();
  const courseStats = dashboardData?.find(d => d.course_id === courseId);
  
  // Local date state synced with preferences
  const localDate = preferences?.final_exam_date 
    ? preferences.final_exam_date.split('T')[0] 
    : '';
  
  // Calculate days until finals
  const getDaysUntilFinals = () => {
    if (!localDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const finals = new Date(localDate);
    finals.setHours(0, 0, 0, 0);
    const diffTime = finals.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntilFinals();
  const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
  const isComingSoon = daysUntil !== null && daysUntil > 7 && daysUntil <= 14;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newDate = e.target.value;
    
    if (newDate) {
      updatePreferences.mutate({
        courseId,
        finalExamDate: newDate,
      });
    }
  };

  const handleStartPractice = (topicId?: string) => {
    if (topicId) {
      navigate(`/course/${courseId}/practice?topic=${topicId}`);
    } else {
      navigate(`/course/${courseId}/exam`);
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="h-full min-h-[280px]">
      <div
        className={`relative rounded-[20px] overflow-hidden transition-all duration-500 h-full flex flex-col ${
          isExpanded ? 'shadow-2xl' : 'shadow-lg hover:shadow-xl'
        }`}
      >
        {/* Gradient Background */}
        <div
          className={`bg-gradient-to-br ${
            isUrgent
              ? 'from-[#EF4444] to-[#DC2626]'
              : isComingSoon
              ? 'from-[#F59E0B] to-[#D97706]'
              : 'from-[#4F46E5] to-[#6366F1]'
          } transition-all duration-300 flex-1 flex flex-col`}
        >
          {/* Header Section - Always Visible */}
          <button
            onClick={handleToggleExpand}
            className="w-full px-8 py-6 text-left group flex-shrink-0"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Title Row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-[12px] bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl text-white font-semibold tracking-tight">Finals Preparation</h2>
                    <p className="text-white/70 text-sm">
                      {courseCode} • {courseTitle}
                    </p>
                  </div>
                </div>

                {/* Date Selector Row */}
                <div className="flex items-center gap-4 ml-16">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/60" />
                    <span className="text-white/70 text-sm">Finals:</span>
                  </div>
                  <input
                    type="date"
                    value={localDate}
                    onChange={handleDateChange}
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 rounded-[8px] bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer text-sm"
                    style={{ colorScheme: 'dark' }}
                  />
                  {daysUntil !== null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-[8px]">
                      {isUrgent && <AlertCircle className="w-3.5 h-3.5 text-white" />}
                      <span className="text-white font-medium text-sm">
                        {daysUntil > 0
                          ? `${daysUntil} days`
                          : daysUntil === 0
                          ? 'Today!'
                          : `${Math.abs(daysUntil)} days ago`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expand/Collapse Button */}
              <div className="flex items-center gap-3">
                <span className="text-white/70 text-sm hidden lg:inline">
                  {isExpanded ? 'Collapse' : 'Study Materials'}
                </span>
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-all">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white" />
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Stats Row - Visible when collapsed */}
          {!isExpanded && (
            <div className="px-8 pb-6 flex-shrink-0">
              <div className="grid grid-cols-3 gap-3 ml-16">
                <StatWidget 
                  icon={BookOpen} 
                  label="Topics" 
                  value={courseStats?.total_topic_count ?? 0} 
                />
                <StatWidget 
                  icon={Target} 
                  label="Mastery" 
                  value={`${courseStats?.mastery_percentage ?? 0}%`} 
                />
                <StatWidget 
                  icon={AlertTriangle} 
                  label="Weak" 
                  value={courseStats?.weak_topic_count ?? 0}
                  color={courseStats?.weak_topic_count && courseStats.weak_topic_count > 3 ? 'red' : 'white'}
                />
              </div>
            </div>
          )}

          {/* Expanded View - Final Pack */}
          {isExpanded && (
            <div className="px-6 pb-6 flex-1 overflow-hidden">
              <div className="bg-white rounded-[16px] overflow-hidden shadow-xl h-full">
                <FinalPackView
                  courseId={courseId}
                  courseCode={courseCode}
                  onStartPractice={handleStartPractice}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FinalsSection;
