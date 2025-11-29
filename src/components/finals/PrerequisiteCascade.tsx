/**
 * Prerequisite Cascade Fixer Component
 * 
 * Shows prerequisite chain A → B → C for weak topics
 * Generates compression notes and questions for missing prerequisites
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, BookOpen, Target, ArrowRight, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeState, useTriggerKSVUpdate } from '@/hooks/useKnowledgeState';
import { useCourseGraph } from '@/hooks/useKnowledgeGraph';
import { useGenerateCompression } from '@/hooks/useCompression';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { expandWeakTopics, getTopicPath } from '@/lib/knowledge-graph';
import LoadingScreen from '@/components/LoadingScreen';

interface PrerequisiteCascadeProps {
  courseId: string;
  topicId?: string; // Optional: if specific topic, show its prerequisites
}

interface PrerequisiteChain {
  topic_id: string;
  topic_name: string;
  level: number;
  knowledge_strength: number;
  hasCompressionNotes: boolean;
  hasQuestions: boolean;
}

export function PrerequisiteCascade({ courseId, topicId }: PrerequisiteCascadeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedWeakTopic, setSelectedWeakTopic] = useState<string | null>(topicId || null);
  const [prerequisiteChains, setPrerequisiteChains] = useState<Record<string, PrerequisiteChain[]>>({});
  
  const { data: ksvData } = useKnowledgeState(courseId);
  const { data: graphEdges } = useCourseGraph(courseId);
  const generateCompression = useGenerateCompression();
  const triggerKSVUpdate = useTriggerKSVUpdate();

  // Get weak topics
  const weakTopics = useMemo(() => {
    return ksvData
      ?.filter(ksv => ksv.knowledge_strength < 0.5)
      .sort((a, b) => a.knowledge_strength - b.knowledge_strength)
      .slice(0, 5) || [];
  }, [ksvData]);

  // Build prerequisite chains for weak topics
  const { isLoading: chainsLoading } = useQuery({
    queryKey: ['prerequisite-chains', courseId, selectedWeakTopic],
    queryFn: async (): Promise<PrerequisiteChain[]> => {
      if (!selectedWeakTopic || !graphEdges || !ksvData) return [];

      // Get all prerequisite edges
      const prereqEdges = graphEdges.filter(e => e.relation === 'prerequisite');
      
      // Build adjacency list: topic -> [prerequisites]
      const prereqMap = new Map<string, string[]>();
      for (const edge of prereqEdges) {
        if (edge.topic_a && edge.topic_b) {
          const prereqs = prereqMap.get(edge.topic_b) || [];
          prereqs.push(edge.topic_a);
          prereqMap.set(edge.topic_b, prereqs);
        }
      }

      // Get topic names map
      const topicNames = new Map<string, string>();
      for (const ksv of ksvData) {
        topicNames.set(ksv.topic_id, ksv.topic_name || 'Unknown');
      }

      // Traverse backwards from weak topic to find prerequisite chain
      const chain: PrerequisiteChain[] = [];
      const visited = new Set<string>();

      const traversePrereqs = (topicId: string, level: number) => {
        if (visited.has(topicId) || level > 5) return; // Max depth
        visited.add(topicId);

        const ksv = ksvData.find(k => k.topic_id === topicId);
        chain.push({
          topic_id: topicId,
          topic_name: topicNames.get(topicId) || 'Unknown',
          level,
          knowledge_strength: ksv?.knowledge_strength || 0,
          hasCompressionNotes: false, // TODO: Check if compression notes exist
          hasQuestions: false, // TODO: Check if questions exist
        });

        const prereqs = prereqMap.get(topicId) || [];
        for (const prereq of prereqs) {
          traversePrereqs(prereq, level + 1);
        }
      };

      traversePrereqs(selectedWeakTopic, 0);

      // Sort by level (deepest prerequisites first)
      return chain.sort((a, b) => b.level - a.level);
    },
    enabled: !!selectedWeakTopic && !!graphEdges && !!ksvData,
    onSuccess: (data) => {
      if (selectedWeakTopic) {
        setPrerequisiteChains(prev => ({ ...prev, [selectedWeakTopic]: data }));
      }
    },
  });

  const handleGenerateCompression = async (topicId: string) => {
    if (!user?.id) return;

    try {
      await generateCompression.mutateAsync({
        user_id: user.id,
        topic_id: topicId,
      });
      
      // Trigger KSV update
      triggerKSVUpdate.mutate(courseId);
    } catch (error) {
      console.error('Error generating compression:', error);
    }
  };

  const handlePracticeTopic = (topicId: string) => {
    navigate(`/course/${courseId}/practice?topic=${topicId}`);
  };

  const currentChain = selectedWeakTopic ? prerequisiteChains[selectedWeakTopic] || [] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-600" />
          Prerequisite Cascade Fixer
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Fix weak topics by mastering their prerequisites first
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weak Topic Selector */}
        {!topicId && (
          <div>
            <label className="text-sm font-medium mb-2 block">Select a weak topic:</label>
            <div className="space-y-2">
              {weakTopics.map(topic => (
                <button
                  key={topic.topic_id}
                  onClick={() => setSelectedWeakTopic(topic.topic_id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedWeakTopic === topic.topic_id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{topic.topic_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {(topic.knowledge_strength * 100).toFixed(0)}% strength
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prerequisite Chain Visualization */}
        {selectedWeakTopic && (
          <div className="space-y-4">
            {chainsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyzing prerequisite chain...</p>
              </div>
            ) : currentChain.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Prerequisite Chain ({currentChain.length} topics):
                </h3>
                <div className="space-y-2">
                  {currentChain.map((prereq, idx) => (
                    <div
                      key={prereq.topic_id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium">
                          {prereq.level}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{prereq.topic_name}</p>
                            {prereq.knowledge_strength < 0.5 && (
                              <Badge variant="destructive" className="text-xs">
                                Weak
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Level {prereq.level} • {(prereq.knowledge_strength * 100).toFixed(0)}% strength
                          </p>
                        </div>
                      </div>
                      {idx < currentChain.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons for Missing Prerequisites */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">Recommended Actions:</h4>
                  <div className="space-y-2">
                    {currentChain
                      .filter(p => p.level > 0 && p.knowledge_strength < 0.5)
                      .slice(0, 3)
                      .map(prereq => (
                        <div
                          key={prereq.topic_id}
                          className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                        >
                          <div>
                            <p className="font-medium text-sm">{prereq.topic_name}</p>
                            <p className="text-xs text-muted-foreground">Missing prerequisite</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateCompression(prereq.topic_id)}
                              disabled={generateCompression.isPending}
                            >
                              <BookOpen className="w-3 h-3 mr-1" />
                              Generate Notes
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handlePracticeTopic(prereq.topic_id)}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Practice
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No prerequisite chain found for this topic.</p>
                <p className="text-xs mt-1">This topic has no prerequisites or the graph isn't available.</p>
              </div>
            )}
          </div>
        )}

        {!selectedWeakTopic && weakTopics.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No weak topics found. Great job!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

