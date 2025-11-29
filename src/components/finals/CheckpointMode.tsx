/**
 * Checkpoint Mode Component
 * 
 * Per-topic assessment: 2 theory Qs + 1 formula recall + 2 final-level problems
 * Shows checkpoint progress and updates KSV after completion
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Target, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeState, useTriggerKSVUpdate } from '@/hooks/useKnowledgeState';
import { useStartSession } from '@/hooks/useSessions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';

interface CheckpointModeProps {
  courseId: string;
  topicId?: string; // Optional: specific topic checkpoint
}

interface CheckpointProgress {
  topic_id: string;
  topic_name: string;
  completed: boolean;
  questions_answered: number;
  total_questions: number;
  accuracy: number;
}

export function CheckpointMode({ courseId, topicId }: CheckpointModeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(topicId || null);
  const [checkpointProgress, setCheckpointProgress] = useState<Record<string, CheckpointProgress>>({});
  
  const { data: ksvData } = useKnowledgeState(courseId);
  const startSession = useStartSession();
  const triggerKSVUpdate = useTriggerKSVUpdate();

  // Get all topics for course
  const { data: topics } = useQuery({
    queryKey: ['topics', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('id, name')
        .eq('course_id', courseId)
        .order('order_index');

      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
  });

  // Get checkpoint questions for a topic (2 theory + 1 formula + 2 final-level)
  const { isLoading: questionsLoading } = useQuery({
    queryKey: ['checkpoint-questions', courseId, selectedTopic],
    queryFn: async () => {
      if (!selectedTopic) return null;

      // Get 2 theory questions (short answer, difficulty 1-2)
      const { data: theoryQs } = await supabase
        .from('questions')
        .select('id')
        .eq('course_id', courseId)
        .eq('topic_id', selectedTopic)
        .in('q_type', ['short'])
        .in('difficulty', [1, 2])
        .limit(2);

      // Get 1 formula recall question (if available, otherwise any question)
      const { data: formulaQs } = await supabase
        .from('questions')
        .select('id')
        .eq('course_id', courseId)
        .eq('topic_id', selectedTopic)
        .limit(1);

      // Get 2 final-level problems (difficulty 3)
      const { data: finalQs } = await supabase
        .from('questions')
        .select('id')
        .eq('course_id', courseId)
        .eq('topic_id', selectedTopic)
        .eq('difficulty', 3)
        .limit(2);

      return {
        theory: theoryQs || [],
        formula: formulaQs?.slice(0, 1) || [],
        final: finalQs || [],
      };
    },
    enabled: !!selectedTopic && !!courseId,
  });

  const handleStartCheckpoint = async (topicId: string) => {
    if (!user) return;

    try {
      // Create a practice session for this checkpoint
      const session = await startSession.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        topic_id: topicId,
        mode: 'practice',
      });

      // Navigate to practice session - checkpoint will be tracked via completion
      navigate(`/session/${session.id}`, {
        state: { checkpoint: true, topicId },
      });
    } catch (error) {
      console.error('Failed to start checkpoint:', error);
    }
  };

  // Calculate overall checkpoint progress
  const completedCheckpoints = Object.values(checkpointProgress).filter(cp => cp.completed).length;
  const totalTopics = topics?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-green-600" />
          Checkpoint Mode
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Complete topic checkpoints: 2 theory Qs + 1 formula + 2 final-level problems
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900">Overall Progress</span>
            <span className="text-sm font-bold text-green-700">
              {completedCheckpoints} / {totalTopics} checkpoints
            </span>
          </div>
          <Progress 
            value={totalTopics > 0 ? (completedCheckpoints / totalTopics) * 100 : 0} 
            className="h-2" 
          />
        </div>

        {/* Topic List */}
        {topics && topics.length > 0 ? (
          <div className="space-y-2">
            {topics.map(topic => {
              const progress = checkpointProgress[topic.id];
              const ksv = ksvData?.find(k => k.topic_id === topic.id);
              const isWeak = ksv && ksv.knowledge_strength < 0.5;

              return (
                <div
                  key={topic.id}
                  className={`p-4 rounded-lg border ${
                    progress?.completed
                      ? 'bg-green-50 border-green-200'
                      : isWeak
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-card border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {progress?.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{topic.name}</p>
                          {isWeak && (
                            <Badge variant="destructive" className="text-xs">
                              Weak
                            </Badge>
                          )}
                        </div>
                        {progress && (
                          <p className="text-xs text-muted-foreground">
                            {progress.questions_answered} / {progress.total_questions} questions •{' '}
                            {(progress.accuracy * 100).toFixed(0)}% accuracy
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartCheckpoint(topic.id)}
                      disabled={questionsLoading}
                    >
                      {progress?.completed ? 'Retake' : 'Start Checkpoint'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No topics available for checkpoints.</p>
          </div>
        )}

        {/* Weak Topics Summary */}
        {ksvData && ksvData.filter(k => k.knowledge_strength < 0.5).length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">Weak Topics</p>
                <p className="text-xs text-orange-700 mt-1">
                  {ksvData.filter(k => k.knowledge_strength < 0.5).length} topics need review.
                  Focus on completing these checkpoints first.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

