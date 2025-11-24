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

import { ArrowLeft, Book, FileText, Zap, Target, RotateCcw, Layers, BookOpen } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCourse, useTopics, useCourseMastery } from '@/hooks';
import { useAuth } from '@/components/auth/AuthProvider';
import { MasteryRing } from './MasteryRing';
import LoadingScreen from './LoadingScreen';

export function CourseHome() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [masteryMode, setMasteryMode] = useState<'pass' | 'a-level' | 'deep'>('a-level');

  // Fetch course data - all hooks called unconditionally (before any early returns)
  const { data: course, isLoading: courseLoading } = useCourse(courseId!);
  const { data: topics, isLoading: topicsLoading } = useTopics(courseId!);
  const { data: mastery, isLoading: masteryLoading } = useCourseMastery(
    user?.id,
    courseId!
  );

  // Combine all loading states
  const isLoading = authLoading || courseLoading || topicsLoading || masteryLoading;

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

  // Calculate mastery percentage
  const totalAttempts = mastery?.reduce((sum, m) => sum + m.num_attempts, 0) || 0;
  const correctAttempts = mastery?.reduce((sum, m) => sum + m.num_correct, 0) || 0;
  const masteryPercentage = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  // Count weak spots
  const weakSpots = mastery?.filter(m => m.mastery_level === 'weak').length || 0;
  const totalTopics = topics?.length || 0;

  const handleBack = () => {
    navigate('/courses');
  };

  const handleStartPractice = (mode?: { id: string; route: string }) => {
    if (mode?.route) {
      navigate(`/course/${courseId}/${mode.route}`);
    } else {
      navigate(`/course/${courseId}/practice`);
    }
  };

  const handleViewCheatsheet = () => {
    navigate(`/course/${courseId}/compression`);
  };

  const handleViewNotes = () => {
    navigate(`/course/${courseId}/compression`);
  };
  const practiceModesRow1 = [
    { id: 'quick-recall', icon: Zap, title: 'Quick Recall', desc: 'Instant warmup', route: 'practice' },
    { id: 'weak-spots', icon: Target, title: 'Weak Spots', desc: 'Adaptive practice', route: 'practice' },
    { id: 'exam-problems', icon: FileText, title: 'Exam Problems', desc: 'Past finals', route: 'exam' }
  ];

  const practiceModesRow2 = [
    { id: 'mistake-replay', icon: RotateCcw, title: 'Mistake Replay', desc: 'Error correction', route: 'practice' },
    { id: 'compression', icon: Layers, title: 'Compression', desc: 'Build cheatsheet', route: 'compression' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-20">
        {/* Course Header */}
        <div className="mb-20">
          <div className="text-sm text-[#6B7280] mb-3">{course.code}</div>
          <h1 className="text-6xl mb-4 tracking-tight">{course.name}</h1>
          {course.term && (
            <div className="text-sm text-[#9CA3AF]">{course.term}</div>
          )}
        </div>

        {/* Finals Readiness Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Large Mastery Ring */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 flex flex-col items-center justify-center">
            <MasteryRing percentage={masteryPercentage} size="lg" showLabel label="Finals Readiness" />
          </div>

          {/* Metrics */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 flex flex-col justify-center">
            <div className="text-sm text-[#9CA3AF] mb-3">Coverage</div>
            <div className="text-5xl mb-2">{totalTopics}</div>
            <div className="text-sm text-[#6B7280]">Topics Covered</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-10 flex flex-col justify-center">
            <div className="text-sm text-[#9CA3AF] mb-3">Focus Areas</div>
            <div className="text-5xl mb-2 text-[#EF4444]">{weakSpots}</div>
            <div className="text-sm text-[#6B7280]">Weak Areas</div>
          </div>
        </div>

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
          
          {/* All modes in single grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onClick={handleViewNotes}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8 text-left hover:border-[#4F46E5] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-[12px] bg-[#F5F3FF] flex items-center justify-center mb-4 group-hover:bg-[#EEF2FF] transition-colors">
                <BookOpen className="w-6 h-6 text-[#4F46E5]" />
              </div>
              <h3 className="text-lg mb-2">Notes & Diagrams</h3>
              <p className="text-sm text-[#6B7280]">Visual summaries</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}