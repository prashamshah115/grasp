/**
 * CourseHome Component - PHASE 4 INTEGRATED
 * Course overview page (default route for /course/:courseId)
 *
 * INTEGRATION STATUS: ✅ Complete
 * - Uses useParams() to get courseId from URL
 * - Uses useCourse() hook for course data (React Query)
 * - Uses useTopics() hook for topic count
 * - Uses useCourseMastery() hook for mastery stats
 * - Uses useNavigate() for navigation
 * - NO props, NO mock data
 */

import { Book, FileText, Zap, Target, Layers, Upload, GraduationCap, Calendar, Clock } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCourse } from '@/hooks';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUserFinalPreferences, useFinalsFlow } from '@/hooks/useFinals';
import LoadingScreen from './LoadingScreen';
import { MaterialsUploadModal } from './MaterialsUploadModal';
import { TaskCompressorCard } from './finals/TaskCompressorCard';
import { FinalsSection } from './finals/FinalsSection';
import { ErrorBoundary } from './errors/ErrorBoundary';

export function CourseHome() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { isLoading: authLoading } = useAuth();
  const [masteryMode, setMasteryMode] = useState<'pass' | 'a-level' | 'deep'>('a-level');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFinalsExpanded, setIsFinalsExpanded] = useState(false);

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useCourse(courseId!);
  
  // Fetch final preferences for countdown
  const { data: preferences } = useUserFinalPreferences(courseId);
  const { flowStep } = useFinalsFlow(courseId);

  // Loading state
  const isLoading = authLoading || courseLoading;
  
  // Calculate days until final
  const getDaysUntilFinal = () => {
    if (!preferences?.final_exam_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const finals = new Date(preferences.final_exam_date);
    finals.setHours(0, 0, 0, 0);
    const diffTime = finals.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };
  
  const daysUntilFinal = getDaysUntilFinal();
  const isUrgent = daysUntilFinal !== null && daysUntilFinal <= 7 && daysUntilFinal >= 0;

  if (isLoading) {
    return <LoadingScreen message="Loading course..." />;
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Course not found</p>
      </div>
    );
  }

  const handleStartPractice = (mode?: { id: string; route: string }) => {
    if (mode?.route) {
      navigate(`/course/${courseId}/${mode.route}`);
    } else {
      navigate(`/course/${courseId}/practice`);
    }
  };

  const handleViewCheatsheet = () => {
    navigate(`/course/${courseId}/compression?tab=finals`);
  };
  const practiceModesRow1 = [
    { id: 'quick-recall', icon: Zap, title: 'Quick Recall', desc: 'Instant warmup', route: 'practice' },
    { id: 'weak-spots', icon: Target, title: 'Weak Spots', desc: 'Adaptive practice', route: 'practice' }
  ];

  const practiceModesRow2 = [
    { id: 'exam-problems', icon: FileText, title: 'Exam Problems', desc: 'Past finals', route: 'exam' },
    { id: 'compression', icon: Layers, title: 'Compression', desc: 'Build cheatsheet', route: 'compression' }
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FAFAFA]">
      {/* Course Hero Section with Upload Button */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1400px] mx-auto px-8 py-12">
          <div className="flex items-center justify-between">
            {/* Course Info - Left aligned for balance */}
            <div className="flex-1" />
            
            {/* Course Title - Centered */}
            <div className="text-center">
              <div className="text-sm text-[#6B7280] mb-2 tracking-wide uppercase font-medium">{course.code}</div>
              <h1 className="text-5xl font-semibold tracking-tight mb-2 text-[#111827]">{course.name}</h1>
              {course.term && (
                <div className="text-sm text-[#9CA3AF] mb-2">{course.term}</div>
              )}
              {daysUntilFinal !== null && (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  isUrgent 
                    ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#EF4444]' 
                    : 'bg-[#DBEAFE] text-[#1E40AF] border border-[#3B82F6]'
                }`}>
                  <Clock className="w-4 h-4" />
                  <span>
                    {daysUntilFinal === 0 
                      ? 'Final is today!' 
                      : daysUntilFinal === 1 
                        ? 'Final is tomorrow' 
                        : `${daysUntilFinal} days until final`}
                  </span>
                </div>
              )}
            </div>
            
            {/* Upload Button - Right side */}
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-[10px] transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Upload your course materials</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid - Side by Side */}
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div 
          className="grid gap-6 transition-all duration-500"
          style={{
            gridTemplateColumns: isFinalsExpanded 
              ? 'minmax(0, 7fr) minmax(0, 3fr)' 
              : 'repeat(2, minmax(0, 1fr))'
          }}
        >
          <FinalsSection
            courseId={courseId!}
            courseCode={course.code}
            courseTitle={course.name}
            isExpanded={isFinalsExpanded}
            onExpandChange={setIsFinalsExpanded}
          />
          <TaskCompressorCard courseId={courseId!} isCompact={isFinalsExpanded} />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-8 pb-20">

        {/* Mode Selector & Main CTA Section */}
        <div className="mb-24">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-3">Mastery Level</div>
              <div className="inline-flex gap-2 bg-[#F9FAFB] p-1.5 rounded-[12px]">
                <button
                  onClick={() => setMasteryMode('pass')}
                  className={`px-5 py-2.5 rounded-[10px] text-sm transition-all duration-200 ${
                    masteryMode === 'pass'
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  Pass
                </button>
                <button
                  onClick={() => setMasteryMode('a-level')}
                  className={`px-5 py-2.5 rounded-[10px] text-sm transition-all duration-200 ${
                    masteryMode === 'a-level'
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  A-Level
                </button>
                <button
                  onClick={() => setMasteryMode('deep')}
                  className={`px-5 py-2.5 rounded-[10px] text-sm transition-all duration-200 ${
                    masteryMode === 'deep'
                      ? 'bg-white text-[#111827] shadow-sm'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  Deep
                </button>
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <button
            onClick={() => handleStartPractice()}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-4 rounded-[12px] transition-all duration-200 shadow-sm hover:shadow-md font-medium tracking-tight"
          >
            Start Smart Final Practice
          </button>
        </div>

        {/* Practice Modes */}
        <div className="mb-24">
          <h2 className="text-3xl mb-3">Practice Modes</h2>
          <p className="text-[#6B7280] mb-10">Choose any mode — enter whenever you need it</p>
          
          {/* Practice modes in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {practiceModesRow1.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleStartPractice(mode)}
                className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-[12px] bg-[#F5F3FF] flex items-center justify-center mb-4 group-hover:bg-[#EEF2FF] transition-colors">
                  <mode.icon className="w-6 h-6 text-[#4F46E5]" />
                </div>
                <h3 className="text-lg mb-2">{mode.title}</h3>
                <p className="text-sm text-[#6B7280]">{mode.desc}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {practiceModesRow2.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleStartPractice(mode)}
                className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-[12px] bg-[#F5F3FF] flex items-center justify-center mb-4 group-hover:bg-[#EEF2FF] transition-colors">
                  <mode.icon className="w-6 h-6 text-[#4F46E5]" />
                </div>
                <h3 className="text-lg mb-2">{mode.title}</h3>
                <p className="text-sm text-[#6B7280]">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="mb-12">
          <h2 className="text-3xl mb-3">Resources</h2>
          <p className="text-[#6B7280] mb-10">Your study materials</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate(`/course/${courseId}/finals/pack`)}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center mb-4 group-hover:bg-[#FDE68A] transition-colors">
                <GraduationCap className="w-6 h-6 text-[#D97706]" />
              </div>
              <h3 className="text-lg mb-2">Final Pack</h3>
              <p className="text-sm text-[#6B7280]">Essentials, drills & must-solve</p>
            </button>
            <button
              onClick={() => {
                if (flowStep === 'NEED_EXAM_DATE') {
                  // Scroll to Finals Pack date picker
                  import('./finals/FinalsSection').then((mod) => {
                    if (typeof mod.scrollToFinalsPackDatePicker === 'function') {
                      mod.scrollToFinalsPackDatePicker();
                    }
                  });
                  return;
                }

                if (flowStep === 'NEED_DIAGNOSTIC') {
                  navigate(`/course/${courseId}/practice?mode=diagnosis`);
                  return;
                }

                navigate(`/course/${courseId}/finals/plan`);
              }}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#DBEAFE] flex items-center justify-center mb-4 group-hover:bg-[#BFDBFE] transition-colors">
                <Calendar className="w-6 h-6 text-[#2563EB]" />
              </div>
              <h3 className="text-lg mb-2">Study Plan</h3>
              <p className="text-sm text-[#6B7280]">
                {flowStep === 'NEED_EXAM_DATE'
                  ? 'Set your exam date on the Finals Pack'
                  : flowStep === 'NEED_DIAGNOSTIC'
                  ? 'Take a quick diagnostic to unlock your plan'
                  : 'Multi-day personalized plan'}
              </p>
            </button>
            <button
              onClick={handleViewCheatsheet}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#F5F3FF] flex items-center justify-center mb-4 group-hover:bg-[#EEF2FF] transition-colors">
                <Book className="w-6 h-6 text-[#4F46E5]" />
              </div>
              <h3 className="text-lg mb-2">Finals Cheatsheet</h3>
              <p className="text-sm text-[#6B7280]">Your compressed reference</p>
            </button>
            <button
              onClick={() => navigate(`/course/${courseId}/finals/upload`)}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#DCFCE7] flex items-center justify-center mb-4 group-hover:bg-[#BBF7D0] transition-colors">
                <FileText className="w-6 h-6 text-[#16A34A]" />
              </div>
              <h3 className="text-lg mb-2">Upload Graded Work</h3>
              <p className="text-sm text-[#6B7280]">Analyze midterms & HWs</p>
            </button>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <MaterialsUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        courseId={courseId!}
        courseName={course.name}
      />
      </div>
    </ErrorBoundary>
  );
}