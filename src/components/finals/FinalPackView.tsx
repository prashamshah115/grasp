/**
 * Final Pack View Component
 * 
 * Displays precomputed study materials in 3 tabs:
 * - Essentials: Key formulas and definitions
 * - Must-Solve: Important topics with priority badges
 * - Drills: Rapid recall exercises
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Target, 
  Zap, 
  FileText, 
  Calculator, 
  Lightbulb, 
  Play, 
  ExternalLink, 
  ChevronRight 
} from 'lucide-react';
import { useFinalPacks, useMustSolveTopics, useTriggerFinalPacks } from '@/hooks/useFinals';
import { useKnowledgeState } from '@/hooks/useKnowledgeState';
import LoadingScreen from '@/components/LoadingScreen';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FinalPackViewProps {
  courseId: string;
  courseCode: string;
  onStartPractice: (topicId?: string) => void;
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

export function FinalPackView({ courseId, courseCode, onStartPractice }: FinalPackViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('essentials');

  // Fetch data from real hooks
  const { data: packs, isLoading: packsLoading, refetch: refetchPacks } = useFinalPacks(courseId);
  const { data: mustSolveData, isLoading: mustSolveLoading } = useMustSolveTopics(courseId);
  const { data: ksvData } = useKnowledgeState(courseId);
  const triggerFinalPacks = useTriggerFinalPacks();

  // Get weak topic IDs for highlighting
  const weakTopicIds = new Set(
    ksvData?.filter(ksv => ksv.knowledge_strength < 0.5).map(ksv => ksv.topic_id) || []
  );

  // Helper to check if a topic is weak
  const isWeakTopic = (topicId?: string) => topicId && weakTopicIds.has(topicId);

  const isLoading = packsLoading || mustSolveLoading;
  const hasNoPacks = !packs || packs.length === 0;

  const handleGeneratePacks = async () => {
    try {
      await triggerFinalPacks.mutateAsync(courseId);
      // Refetch after a delay to check for new packs
      setTimeout(() => refetchPacks(), 5000);
    } catch (error) {
      console.error('Failed to trigger final pack generation:', error);
    }
  };

  // Extract essentials and drills from packs
  const essentialsPack = packs?.find(p => p.tier === 'essentials');
  const drillsPack = packs?.find(p => p.tier === 'drills');

  const essentials = essentialsPack?.content as EssentialsContent | undefined;
  const drillsContent = drillsPack?.content as DrillsContent | undefined;

  // Get personalized annotation text
  const weakTopicNames = ksvData
    ?.filter(ksv => ksv.knowledge_strength < 0.5)
    .slice(0, 3)
    .map(ksv => ksv.topic_name)
    .filter(Boolean) || [];

  const personalizedAnnotation = weakTopicNames.length > 0
    ? `Your recent wrong answers suggest focusing on these formulas first: ${weakTopicNames.join(', ')}.`
    : null;

  // Transform essentials data into key formulas and definitions
  const keyFormulas = essentials?.topics?.flatMap((topic, topicIdx) => 
    (topic.formulas || []).map((formula, formulaIdx) => ({
      id: `${topicIdx}-${formulaIdx}`,
      topic: formula.name || topic.name,
      formula: formula.plain || formula.latex,
      topicId: topic.topic_id, // If available in final pack content
    }))
  ) || [];

  const keyDefinitions = essentials?.topics?.flatMap((topic, topicIdx) => 
    (topic.key_concepts || []).map((concept, conceptIdx) => ({
      id: `${topicIdx}-${conceptIdx}`,
      term: concept,
      definition: topic.summary || concept,
    }))
  ).slice(0, 6) || []; // Limit to 6 definitions for UI

  // Drills data
  const drills = drillsContent?.drills?.map((drill, idx) => ({
    id: drill.id || String(idx),
    title: drill.prompt,
    topic: drill.topic,
    type: drill.type,
    questions: 1,
    duration: 1,
    completed: false, // Would need tracking in DB
  })) || [];

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

  if (isLoading) {
    return <LoadingScreen message="Loading study materials..." />;
  }

  return (
    <div className="w-full">
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
            {/* Personalized Annotation */}
            {personalizedAnnotation && weakTopicNames.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">Personalized Recommendation</p>
                  <p className="text-sm text-blue-800">{personalizedAnnotation}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Key Formulas</h3>
                <span className="text-sm text-[#9CA3AF]">{keyFormulas.length} formulas</span>
              </div>
              {keyFormulas.length > 0 ? (
                <div className="space-y-3">
                  {keyFormulas.map((item) => {
                    const isWeak = item.topicId ? isWeakTopic(item.topicId) : false;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-[12px] border transition-all group ${
                          isWeak
                            ? 'bg-orange-50 border-orange-200 hover:border-orange-400'
                            : 'bg-[#F9FAFB] border-[#E5E7EB] hover:border-[#4F46E5]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 ${
                            isWeak ? 'bg-orange-100' : 'bg-[#EEF2FF]'
                          }`}>
                            <Calculator className={`w-4 h-4 ${isWeak ? 'text-orange-600' : 'text-[#4F46E5]'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm ${isWeak ? 'text-orange-700' : 'text-[#9CA3AF]'}`}>{item.topic}</p>
                              {isWeak && (
                                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                                  Focus
                                </Badge>
                              )}
                            </div>
                            <p className="font-mono text-sm">{item.formula}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center">
                  <p className="text-[#6B7280] mb-4">No formulas available yet. Upload course materials to generate.</p>
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
              {keyDefinitions.length > 0 ? (
                <div className="space-y-3">
                  {keyDefinitions.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] hover:border-[#4F46E5] transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="w-4 h-4 text-[#F59E0B]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">{item.term}</p>
                          <p className="text-sm text-[#6B7280]">{item.definition}</p>
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
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Important Topics</h3>
                <span className="text-sm text-[#9CA3AF]">{mustSolveData?.totalQuestions || 0} questions</span>
              </div>
              {mustSolveData?.importantTopics && mustSolveData.importantTopics.length > 0 ? (
                <div className="space-y-3">
                  {mustSolveData.importantTopics.map((topic) => {
                    const isWeak = isWeakTopic(topic.id);
                    const ksvForTopic = ksvData?.find(ksv => ksv.topic_id === topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => onStartPractice(topic.id)}
                        className={`w-full p-5 rounded-[14px] border transition-all group text-left ${
                          isWeak
                            ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-400'
                            : 'bg-[#FAFAFA] hover:bg-[#F5F5F5] border-[#E5E7EB] hover:border-[#4F46E5]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center border ${
                              isWeak ? 'bg-orange-100 border-orange-300' : 'bg-white border-[#E5E7EB]'
                            }`}>
                              <Target className={`w-5 h-5 ${isWeak ? 'text-orange-600' : 'text-[#4F46E5]'}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <p className="font-medium">{topic.topic}</p>
                                <span className={`px-2 py-0.5 rounded-[6px] text-xs font-medium ${getPriorityColor(topic.priority)}`}>
                                  {topic.priority}
                                </span>
                                {isWeak && (
                                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Weak
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-[#6B7280]">
                                <span>{topic.questions} questions</span>
                                <span>•</span>
                                <span>{topic.difficulty}</span>
                                {ksvForTopic && (
                                  <>
                                    <span>•</span>
                                    <span>{(ksvForTopic.knowledge_strength * 100).toFixed(0)}% strength</span>
                                  </>
                                )}
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
              onClick={() => onStartPractice()}
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
                  {drills.length} drills available
                </span>
              </div>
              {drills.length > 0 ? (
                <div className="space-y-3">
                  {drills.slice(0, 6).map((drill) => (
                    <button
                      key={drill.id}
                      onClick={() => onStartPractice()}
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
                <div className="p-6 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] text-center text-[#6B7280]">
                  No drills available yet. Upload course materials to generate rapid recall exercises.
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
            {drills.length > 0 && (
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
                    {drills.filter(d => d.completed).length}/{drills.length}
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
