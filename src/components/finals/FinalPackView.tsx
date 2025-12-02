/**
 * Final Pack View Component
 * 
 * Displays precomputed study materials in 3 tabs:
 * - Essentials: Key formulas and definitions
 * - Must-Solve: Important topics with priority badges
 * - Drills: Rapid recall exercises
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BookOpen, 
  Target, 
  Zap, 
  FileText, 
  Calculator, 
  Lightbulb, 
  Play, 
  ExternalLink, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useFinalPacks, useMustSolveTopics, useTriggerFinalPacks, useTriggerPersonalizedStudyPack } from '@/hooks/useFinals';
import { useFinalPacksPrerequisites, useJobStatusPolling } from '@/hooks/useJobStatus';
import { JobStatusIndicator } from '@/components/shared/JobStatusIndicator';
import LoadingScreen from '@/components/LoadingScreen';
import { RefreshCw, Loader2, AlertCircle, CheckCircle, FileText as FileTextIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCourse } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { fetchExams } from '@/lib/api';

interface FinalPackViewProps {
  /**
   * Optional explicit courseId / courseCode when used inside a parent like `FinalsSection`.
   * When not provided (e.g. route `/course/:courseId/finals/pack`), the component
   * falls back to `useParams()` to resolve the courseId.
   */
  courseId?: string;
  courseCode?: string;
  onStartPractice?: (topicId?: string) => void;
}

type TabType = 'essentials' | 'must-solve' | 'drills';

// Types for essentials content from final_packs
interface EssentialsContent {
  topics: Array<{
    name: string;
    key_concepts: string[];
    formulas: Array<{
      name: string;
      latex: string;
      plain: string;
    }>;
    summary: string;
  }>;
}

// Types for drills content from final_packs
interface DrillsContent {
  drills: Array<{
    id: string;
    topic: string;
    type: 'definition' | 'formula' | 'concept';
    prompt: string;
    answer: string;
  }>;
}

export function FinalPackView({ courseId: propCourseId, courseCode: propCourseCode, onStartPractice }: FinalPackViewProps) {
  const navigate = useNavigate();
  const { courseId: paramCourseId } = useParams<{ courseId: string }>();
  const courseId = propCourseId || paramCourseId || '';
  const { data: course } = useCourse(courseId);
  const courseCode = propCourseCode || course?.code || '';
  const [activeTab, setActiveTab] = useState<TabType>('essentials');

  // Fetch data from finals hooks (prioritizes personalized, falls back to course-level)
  const { data: packs, isLoading: packsLoading, error: packsError, refetch: refetchPacks } = useFinalPacks(courseId);
  
  // Check if packs are personalized
  const isPersonalized = packs && packs.length > 0 && packs[0]?.is_personalized === true;
  const { data: mustSolveData, isLoading: mustSolveLoading, error: mustSolveError } = useMustSolveTopics(courseId);
  const triggerFinalPacks = useTriggerFinalPacks();
  const triggerPersonalizedPack = useTriggerPersonalizedStudyPack(); // NEW: Personalized pack trigger
  
  // Prerequisites check (course materials, etc.)
  const { data: prerequisites, isLoading: prerequisitesLoading, error: prerequisitesError } = useFinalPacksPrerequisites(courseId);
  
  // Job status polling - only enable when we have a job running
  const [jobTriggered, setJobTriggered] = useState(false);
  const { data: jobStatus } = useJobStatusPolling(
    'final_packs',
    courseId,
    null,
    { enabled: jobTriggered }
  );

  const isLoading = packsLoading || mustSolveLoading || prerequisitesLoading;
  const hasNoPacks = !packs || packs.length === 0;

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  // Reset job tracking when job completes or fails
  React.useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setJobTriggered(false);
      setGenerateSuccess(true);
      setGenerateError(null);
      // Refetch packs to get new data
      refetchPacks();
      // Hide success message after 5 seconds
      const timer = setTimeout(() => setGenerateSuccess(false), 5000);
      return () => clearTimeout(timer);
    } else if (jobStatus?.status === 'failed') {
      setJobTriggered(false);
      setGenerateSuccess(false);
      setGenerateError(jobStatus.error_message || 'Failed to generate study materials. Please try again.');
      // Hide error message after 10 seconds
      const timer = setTimeout(() => setGenerateError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [jobStatus?.status, jobStatus?.error_message]);

  const handleGeneratePacks = async () => {
    setGenerateError(null);
    setGenerateSuccess(false);
    
    // Check prerequisites first
    if (!prerequisites?.can_generate) {
      const missingItems = prerequisites?.missing_items || [];
      let errorMsg = 'Cannot generate final packs. ';
      if (missingItems.includes('knowledge_objects')) {
        errorMsg += 'Please upload course materials and wait for processing to complete.';
      } else {
        errorMsg += `Missing: ${missingItems.join(', ')}.`;
      }
      setGenerateError(errorMsg);
      setTimeout(() => setGenerateError(null), 10000);
      return;
    }
    
    try {
      await triggerFinalPacks.mutateAsync(courseId);
      setJobTriggered(true); // Start polling for job status
    } catch (error: any) {
      console.error('Failed to trigger final pack generation:', error);
      const errorMessage = error?.message || error?.context?.message || 'Failed to generate study materials. Please try again.';
      setGenerateError(errorMessage);
      setTimeout(() => setGenerateError(null), 10000);
    }
  };

  // Extract essentials and drills from packs
  const essentialsPack = packs?.find(p => p.tier === 'essentials');
  const drillsPack = packs?.find(p => p.tier === 'drills');

  const essentials = essentialsPack?.content as EssentialsContent | any | undefined;
  const drillsContent = drillsPack?.content as DrillsContent | undefined;
  
  // Handle "items" array structure for essentials (new format)
  const essentialsItems = (essentials as any)?.items || [];

  // Default practice starter when parent doesn't pass a handler
  const handleStartPracticeDefault = (topicId?: string) => {
    if (!courseId) return;
    if (topicId) {
      navigate(`/course/${courseId}/practice?topic=${topicId}`);
    } else {
      navigate(`/course/${courseId}/practice`);
    }
  };

  const startPractice = onStartPractice || handleStartPracticeDefault;

  // Transform essentials data into key formulas and definitions
  // Handle different possible data structures
  const keyFormulas = (() => {
    if (!essentials || typeof essentials !== 'object') return [];
    
    // NEW: Handle "items" array structure (current format)
    if (Array.isArray(essentialsItems) && essentialsItems.length > 0) {
      return essentialsItems
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any, idx: number) => ({
          id: `item-${idx}`,
          topic: item.title || item.topic || 'Essential',
          formula: item.short_answer || item.prompt || item.answer || '',
          topicId: item.topic_id || item.id,
          title: item.title,
          prompt: item.prompt,
        }))
        .slice(0, 10); // Limit to 10 for display
    }
    
    // Try topics array structure
    if (Array.isArray(essentials.topics)) {
      return essentials.topics
        .filter((topic: any) => topic && typeof topic === 'object')
        .flatMap((topic: any, topicIdx: number) => 
          (Array.isArray(topic.formulas) ? topic.formulas : [])
            .filter((formula: any) => formula && typeof formula === 'object')
            .map((formula: any, formulaIdx: number) => ({
              id: `${topicIdx}-${formulaIdx}`,
              topic: formula.name || topic.name || 'Formula',
              formula: formula.plain || formula.latex || formula.name || '',
              topicId: topic.topic_id || topic.id,
            }))
        );
    }
    
    // Try direct formulas array
    if (Array.isArray(essentials.formulas)) {
      return essentials.formulas
        .filter((formula: any) => formula && typeof formula === 'object')
        .map((formula: any, idx: number) => ({
          id: `formula-${idx}`,
          topic: formula.topic || formula.name || 'Formula',
          formula: formula.plain || formula.latex || formula.name || '',
          topicId: formula.topic_id || formula.id,
        }));
    }
    
    // Try key_formulas array
    if (Array.isArray((essentials as any).key_formulas)) {
      return (essentials as any).key_formulas
        .filter((formula: any) => formula && typeof formula === 'object')
        .map((formula: any, idx: number) => ({
          id: `formula-${idx}`,
          topic: formula.topic || formula.name || 'Formula',
          formula: formula.plain || formula.latex || formula.formula || formula.name || '',
          topicId: formula.topic_id || formula.id,
        }));
    }
    
    return [];
  })();

  const keyDefinitions = (() => {
    if (!essentials) return [];
    
    // NEW: Handle "items" array structure (current format)
    if (Array.isArray(essentialsItems) && essentialsItems.length > 0) {
      return essentialsItems
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any, idx: number) => ({
          id: `def-item-${idx}`,
          term: item.title || item.topic || 'Term',
          definition: item.short_answer || item.prompt || item.answer || 'Definition',
        }))
        .slice(0, 6); // Limit to 6 definitions for UI
    }
    
    // Try topics array structure
    if (Array.isArray(essentials.topics)) {
      return essentials.topics
        .filter((topic: any) => topic && typeof topic === 'object')
        .flatMap((topic: any, topicIdx: number) => 
          (Array.isArray(topic.key_concepts) ? topic.key_concepts : []).map((concept: any, conceptIdx: number) => ({
            id: `${topicIdx}-${conceptIdx}`,
            term: typeof concept === 'string' ? concept : concept.name || concept.term || 'Term',
            definition: topic.summary || (typeof concept === 'string' ? concept : concept.definition) || 'Definition',
          }))
        )
        .slice(0, 6); // Limit to 6 definitions for UI
    }
    
    // Try direct definitions array
    if (Array.isArray(essentials.definitions)) {
      return essentials.definitions
        .slice(0, 6)
        .map((def: any, idx: number) => ({
          id: `def-${idx}`,
          term: def.term || def.name || 'Term',
          definition: def.definition || def.text || 'Definition',
        }));
    }
    
    return [];
  })();

  // Drills data - if no drills from packs, show practice exams instead
  const drills = (() => {
    if (!drillsContent || typeof drillsContent !== 'object' || !Array.isArray(drillsContent.drills)) return [];
    
    return drillsContent.drills
      .filter((drill: any) => drill && typeof drill === 'object')
      .map((drill: any, idx: number) => ({
        id: drill.id || String(idx),
        title: drill.prompt || drill.title || drill.question || 'Drill',
        topic: drill.topic || 'General',
        type: drill.type || 'concept',
        questions: drill.questions || 1,
        duration: drill.duration || 1,
        completed: false, // Would need tracking in DB
      }));
  })();
  
  // If no drills from packs, we'll show a message and link to practice exams
  const hasDrillsFromPacks = drills && Array.isArray(drills) && drills.length > 0;

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-[#FEE2E2] text-[#EF4444]';
      case 'high':
        return 'bg-[#FEF3C7] text-[#F59E0B]';
      case 'medium':
        return 'bg-[#DBEAFE] text-[#3B82F6]';
      default:
        return 'bg-[#F3F4F6] text-[#6B7280]';
    }
  };

  // Component for Practice Final Links
  function PracticeFinalLinks({ courseId }: { courseId: string }) {
    const { data: exams, isLoading: examsLoading } = useQuery({
      queryKey: ['practice-finals', courseId],
      queryFn: () => fetchExams(courseId),
      enabled: !!courseId,
    });

    if (examsLoading) {
      return (
        <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#6B7280]" />
        </div>
      );
    }

    if (!exams || exams.length === 0) {
      return (
        <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center text-[#6B7280]">
          <p className="mb-2">No practice finals available yet.</p>
          <p className="text-sm">Practice finals will appear here once exams are added to the course.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {exams.map((exam: any) => (
          <button
            key={exam.id}
            onClick={() => navigate(`/exam/${exam.id}`)}
            className="w-full p-5 rounded-[14px] border transition-all group text-left bg-[#FAFAFA] hover:bg-[#F5F5F5] border-[#E5E7EB] hover:border-[#4F46E5]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center border bg-white border-[#E5E7EB]">
                  <FileTextIcon className="w-5 h-5 text-[#4F46E5]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-medium">{exam.name || 'Practice Final'}</p>
                    {exam.exam_type && (
                      <span className="px-2 py-0.5 rounded-[6px] text-xs bg-[#DBEAFE] text-[#3B82F6]">
                        {exam.exam_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                    {exam.num_questions && (
                      <>
                        <span>{exam.num_questions} questions</span>
                        <span>•</span>
                      </>
                    )}
                    {exam.duration_min && (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>{exam.duration_min} min</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity">
                  Start Exam
                </span>
                <ChevronRight className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#4F46E5] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Guard: no course selected (defensive, should not happen for valid routes)
  if (!courseId) {
    return (
      <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center text-[#6B7280]">
        Final pack not available – no course selected.
      </div>
    );
  }

  // Global loading state
  if (isLoading) {
    return <LoadingScreen message="Loading study materials..." />;
  }

  // Surface any query errors as a friendly inline error instead of crashing the panel
  if (packsError || mustSolveError || prerequisitesError) {
    return (
      <div className="p-6 bg-red-50 rounded-[12px] border border-red-200">
        <p className="text-sm text-red-700 font-medium mb-1">Final Pack temporarily unavailable.</p>
        <p className="text-sm text-red-600">
          Please try again in a few minutes. If this keeps happening, contact support.
        </p>
      </div>
    );
  }

  // Handler for generating personalized pack
  const handleGeneratePersonalized = async () => {
    setGenerateError(null);
    setGenerateSuccess(false);
    
    try {
      await triggerPersonalizedPack.mutateAsync(courseId);
      setJobTriggered(true);
      setGenerateSuccess(true);
      setTimeout(() => {
        refetchPacks();
        setGenerateSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to trigger personalized pack generation:', error);
      const errorMessage = error?.message || error?.context?.message || 'Failed to generate personalized study pack. Please try again.';
      setGenerateError(errorMessage);
      setTimeout(() => setGenerateError(null), 10000);
    }
  };

  // No packs yet – render a clear empty state with optional generate button
  if (hasNoPacks) {
    return (
      <div className="p-8 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center">
        <h3 className="text-lg font-medium text-[#111827] mb-2">Final Pack not generated yet</h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Once your instructor or admin generates the finals pack for {courseCode || 'this course'}, it will appear here for everyone.
        </p>
        <div className="flex flex-col items-center gap-3">
          {/* Job Status Indicator */}
          {jobTriggered && (
            <div className="w-full max-w-md">
              <JobStatusIndicator
                jobType="final_packs"
                courseId={courseId}
                userId={null}
                enabled={jobTriggered}
                onComplete={() => {
                  setJobTriggered(false);
                  setGenerateSuccess(true);
                  refetchPacks();
                }}
                onError={(status) => {
                  setJobTriggered(false);
                  setGenerateError(status.error_message || 'Generation failed');
                }}
              />
            </div>
          )}
          
          {generateError && !jobTriggered && (
            <div className="w-full max-w-md p-3 bg-red-50 border border-red-200 rounded-lg text-left">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {generateError}
              </p>
            </div>
          )}
          {generateSuccess && !jobTriggered && (
            <div className="w-full max-w-md p-3 bg-green-50 border border-green-200 rounded-lg text-left">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Study materials generated successfully! Refreshing...
              </p>
            </div>
          )}
          {!jobTriggered && (
            <div className="flex flex-col gap-2 w-full max-w-md">
              <button
                onClick={handleGeneratePersonalized}
                disabled={triggerPersonalizedPack.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white rounded-lg hover:from-[#4338CA] hover:to-[#6D28D9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggerPersonalizedPack.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating personalized pack...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Personalized Pack
                  </>
                )}
              </button>
              <button
                onClick={handleGeneratePacks}
                disabled={triggerFinalPacks.isPending || prerequisitesLoading || !prerequisites?.can_generate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggerFinalPacks.isPending || prerequisitesLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {prerequisitesLoading ? 'Checking prerequisites...' : 'Starting generation...'}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {prerequisites?.can_generate ? 'Generate Course Pack' : 'Cannot generate yet'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
        {/* Header with personalization badge */}
        {isPersonalized && (
          <div className="px-8 pt-6 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#EEF2FF] to-[#E0E7FF] rounded-full border border-[#4F46E5]/20">
              <Sparkles className="w-4 h-4 text-[#4F46E5]" />
              <span className="text-sm font-medium text-[#4F46E5]">Personalized for you</span>
            </div>
          </div>
        )}

        {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <button
          onClick={() => setActiveTab('essentials')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
            activeTab === 'essentials'
              ? 'text-[#4F46E5] border-b-2 border-[#4F46E5] bg-white'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-white/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>Essentials</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('must-solve')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
            activeTab === 'must-solve'
              ? 'text-[#4F46E5] border-b-2 border-[#4F46E5] bg-white'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-white/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Target className="w-4 h-4" />
            <span>Must-Solve</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('drills')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
            activeTab === 'drills'
              ? 'text-[#4F46E5] border-b-2 border-[#4F46E5] bg-white'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-white/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Drills</span>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-8">
        {/* Essentials Tab */}
        {activeTab === 'essentials' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Essential Items</h3>
                <span className="text-sm text-[#9CA3AF]">{keyFormulas.length} items</span>
              </div>
              {keyFormulas && Array.isArray(keyFormulas) && keyFormulas.length > 0 ? (
                <div className="space-y-3">
                  {keyFormulas.filter(item => item && item.id).map((item) => {
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-[12px] border transition-all group ${
                          'bg-[#F9FAFB] border-[#E5E7EB] hover:border-[#4F46E5]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 ${
                            'bg-[#EEF2FF]'
                          }`}>
                            <Lightbulb className="w-4 h-4 text-[#4F46E5]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-medium text-[#111827]">{item.title || item.topic || 'Essential Item'}</p>
                            </div>
                            {item.prompt && (
                              <p className="text-sm text-[#6B7280] mb-2">{item.prompt}</p>
                            )}
                            {item.formula && (
                              <p className="text-sm font-mono text-[#111827] bg-white p-2 rounded border border-[#E5E7EB]">{item.formula}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center">
                  <p className="text-[#6B7280] mb-4">No formulas available yet. Upload course materials to generate.</p>
                  {generateError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {generateError}
                      </p>
                    </div>
                  )}
                  {generateSuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">Study materials generation started! This may take a few minutes.</p>
                    </div>
                  )}
                  {hasNoPacks && (
                    <button
                      onClick={handleGeneratePacks}
                      disabled={triggerFinalPacks.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50"
                    >
                      {triggerFinalPacks.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Generate Study Materials
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-[#E5E7EB]" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Key Definitions</h3>
                <span className="text-sm text-[#9CA3AF]">{keyDefinitions.length} definitions</span>
              </div>
              {keyDefinitions && Array.isArray(keyDefinitions) && keyDefinitions.length > 0 ? (
                <div className="space-y-3">
                  {keyDefinitions.filter(item => item && item.id).map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] hover:border-[#4F46E5] transition-all"
                      >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="w-4 h-4 text-[#F59E0B]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">{item.term || 'Term'}</p>
                          <p className="text-sm text-[#6B7280]">{item.definition || 'Definition'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center text-[#6B7280]">
                  No definitions available yet. Upload course materials to generate.
                </div>
              )}
            </div>

            <div className="h-px bg-[#E5E7EB]" />

            {/* View Full Cheatsheet CTA */}
            <button 
              onClick={() => navigate(`/course/${courseId}/compression?tab=finals`)}
              className="w-full p-6 bg-gradient-to-br from-[#F5F3FF] to-[#EEF2FF] rounded-[14px] border border-[#4F46E5]/20 hover:border-[#4F46E5] transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[12px] bg-[#4F46E5] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium mb-1">View Full Finals Cheatsheet</p>
                    <p className="text-sm text-[#6B7280]">Complete reference with all topics</p>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-[#4F46E5] group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        {/* Must-Solve Tab */}
        {activeTab === 'must-solve' && (
          <div className="space-y-6">
            {/* Practice Final Links Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Practice Final Exams</h3>
                <span className="text-sm text-[#9CA3AF]">Past finals & simulations</span>
              </div>
              <PracticeFinalLinks courseId={courseId} />
            </div>

            <div className="h-px bg-[#E5E7EB]" />

            {/* Topicwise Questions Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Topicwise Questions</h3>
                <span className="text-sm text-[#9CA3AF]">{mustSolveData?.totalQuestions || 0} questions</span>
              </div>
              {mustSolveData?.importantTopics && Array.isArray(mustSolveData.importantTopics) && mustSolveData.importantTopics.length > 0 ? (
                <div className="space-y-3">
                  {mustSolveData.importantTopics.filter(topic => topic && topic.id).map((topic) => {
                    return (
                      <button
                        key={topic.id}
                        onClick={() => startPractice(topic.id)}
                        className={`w-full p-5 rounded-[14px] border transition-all group text-left ${
                          'bg-[#FAFAFA] hover:bg-[#F5F5F5] border-[#E5E7EB] hover:border-[#4F46E5]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center border bg-white border-[#E5E7EB]">
                              <Target className="w-5 h-5 text-[#4F46E5]" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <p className="font-medium">{topic.topic}</p>
                                <span className={`px-2 py-0.5 rounded-[6px] text-xs font-medium ${getPriorityColor(topic.priority)}`}>
                                  {topic.priority}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                                <span>{topic.questions} questions</span>
                                <span>•</span>
                                <span>{topic.difficulty}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity">
                              Start Practice
                            </span>
                            <ChevronRight className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#4F46E5] group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center text-[#6B7280]">
                  No practice topics available yet. Add course materials and questions.
                </div>
              )}
            </div>

            <div className="h-px bg-[#E5E7EB]" />

            {/* Start Full Practice CTA */}
            <button
              onClick={() => startPractice()}
              className="w-full p-6 bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] text-white rounded-[14px] transition-all shadow-md hover:shadow-lg group"
            >
              <div className="flex items-center justify-center gap-3">
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Start Full Finals Practice</span>
                <span className="text-sm text-white/80">({mustSolveData?.totalQuestions || 0} questions)</span>
              </div>
            </button>
          </div>
        )}

        {/* Drills Tab */}
        {activeTab === 'drills' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Rapid Recall Drills</h3>
                <span className="text-sm text-[#9CA3AF]">
                  {hasDrillsFromPacks ? `${drills.length} drills available` : 'Practice Exams'}
                </span>
              </div>
              {hasDrillsFromPacks && drills && Array.isArray(drills) && drills.length > 0 ? (
                <div className="space-y-3">
                  {drills.filter(drill => drill && drill.id).slice(0, 6).map((drill) => (
                    <button
                      key={drill.id}
                      onClick={() => navigate(`/course/${courseId}/exam`)}
                      className="w-full p-5 bg-[#FAFAFA] hover:bg-[#F5F5F5] rounded-[14px] border border-[#E5E7EB] hover:border-[#4F46E5] transition-all group text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${
                            drill.completed ? 'bg-[#D1FAE5]' : 'bg-white border border-[#E5E7EB]'
                          }`}>
                            <Zap className={`w-5 h-5 ${drill.completed ? 'text-[#10B981]' : 'text-[#F59E0B]'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <p className="font-medium line-clamp-1">{drill.title}</p>
                              {drill.completed && (
                                <span className="px-2 py-0.5 rounded-[6px] text-xs bg-[#D1FAE5] text-[#10B981]">
                                  ✓ Completed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                              <span className="capitalize">{drill.type}</span>
                              <span>•</span>
                              <span>{drill.topic}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity">
                            {drill.completed ? 'Review' : 'Start'}
                          </span>
                          <Play className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#4F46E5] transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center">
                  <p className="text-[#6B7280] mb-4">
                    No drills available yet. Practice with full-length exam simulations instead.
                  </p>
                  <button
                    onClick={() => navigate(`/course/${courseId}/exam`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Go to Practice Exams
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-[#E5E7EB]" />

            {/* Start Full Exam Practice CTA */}
            <button
              onClick={() => navigate(`/course/${courseId}/exam`)}
              className="w-full p-6 bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] text-white rounded-[14px] transition-all shadow-md hover:shadow-lg group"
            >
              <div className="flex items-center justify-center gap-3">
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Start Full Finals Practice</span>
                <span className="text-sm text-white/80">({mustSolveData?.totalQuestions || 0} questions)</span>
              </div>
            </button>

            {/* Progress Stats */}
            {drills && Array.isArray(drills) && drills.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-[#F9FAFB] rounded-[12px] text-center">
                  <div className="text-2xl font-semibold mb-1">{drills.length}</div>
                  <div className="text-xs text-[#6B7280]">Total Drills</div>
                </div>
                <div className="p-4 bg-[#F9FAFB] rounded-[12px] text-center">
                  <div className="text-2xl font-semibold mb-1">{mustSolveData?.totalQuestions || 0}</div>
                  <div className="text-xs text-[#6B7280]">Total Questions</div>
                </div>
                <div className="p-4 bg-[#F9FAFB] rounded-[12px] text-center">
                  <div className="text-2xl font-semibold mb-1 text-[#10B981]">
                    {drills.filter(d => d && d.completed).length}/{drills.length}
                  </div>
                  <div className="text-xs text-[#6B7280]">Completed</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FinalPackView;
