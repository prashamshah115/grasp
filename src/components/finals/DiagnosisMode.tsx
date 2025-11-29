/**
 * 5-Question Diagnosis Component
 * 
 * Selects 5 hyper-targeted questions from weakest topics
 * Updates KSV and shows weakness heatmap after completion
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, TrendingUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeState, useTriggerKSVUpdate } from '@/hooks/useKnowledgeState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSubmitAnswer } from '@/hooks/useSessions';
import { useUpdateMastery } from '@/hooks/useMastery';
import LoadingScreen from '@/components/LoadingScreen';

interface DiagnosisModeProps {
  courseId: string;
  onComplete?: (results: DiagnosisResults) => void;
}

interface DiagnosisResults {
  questionsAnswered: number;
  correctAnswers: number;
  weakTopics: Array<{
    topic_id: string;
    topic_name: string;
    strength: number;
  }>;
  improvementRecommendations: string[];
}

interface DiagnosisQuestion {
  id: string;
  prompt: string;
  options?: string[];
  topic_id: string;
  topic_name: string;
  difficulty: number;
}

export function DiagnosisMode({ courseId, onComplete }: DiagnosisModeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<DiagnosisQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const { data: ksvData } = useKnowledgeState(courseId);
  const submitAnswerMutation = useSubmitAnswer();
  const updateMasteryMutation = useUpdateMastery();
  const triggerKSVUpdate = useTriggerKSVUpdate();

  // Fetch questions for diagnosis
  const { isLoading: questionsLoading, refetch: fetchQuestions } = useQuery({
    queryKey: ['diagnosis-questions', courseId],
    queryFn: async (): Promise<DiagnosisQuestion[]> => {
      if (!ksvData || ksvData.length === 0) return [];

      // Get top 5 weakest topics
      const weakestTopics = [...ksvData]
        .sort((a, b) => a.knowledge_strength - b.knowledge_strength)
        .slice(0, 5)
        .map(ksv => ({
          topicId: ksv.topic_id,
          topicName: ksv.topic_name || 'Unknown Topic',
          strength: ksv.knowledge_strength,
        }));

      // Fetch one question per topic (prefer medium difficulty)
      const questions: DiagnosisQuestion[] = [];
      
      for (const topic of weakestTopics) {
        const { data: topicQuestions, error } = await supabase
          .from('questions')
          .select('id, prompt, options, topic_id, difficulty')
          .eq('course_id', courseId)
          .eq('topic_id', topic.topicId)
          .in('difficulty', [2]) // Medium difficulty
          .limit(1);

        if (!error && topicQuestions && topicQuestions.length > 0) {
          questions.push({
            id: topicQuestions[0].id,
            prompt: topicQuestions[0].prompt,
            options: topicQuestions[0].options as string[] | undefined,
            topic_id: topic.topicId,
            topic_name: topic.topicName,
            difficulty: topicQuestions[0].difficulty || 2,
          });
        }
      }

      return questions;
    },
    enabled: !!courseId && !!ksvData && ksvData.length > 0,
  });

  const handleStartDiagnosis = async () => {
    const { data } = await fetchQuestions();
    if (data && data.length > 0) {
      setQuestions(data);
      setIsDiagnosing(true);
    }
  };

  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All questions answered, submit all and show results
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user || questions.length === 0) return;

    const allResults: Record<string, boolean> = {};
    let correctCount = 0;

    // Create a single session for all diagnosis questions
    try {
      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          course_id: courseId,
          mode: 'practice',
        })
        .select()
        .single();

      if (sessionError || !session) {
        console.error('Error creating session:', sessionError);
        return;
      }

      // Submit all answers
      for (const question of questions) {
        const answer = answers[question.id];
        if (!answer) continue;

        try {
          const result = await submitAnswerMutation.mutateAsync({
            session_id: session.id,
            question_id: question.id,
            user_id: user.id,
            answer,
            time_taken_sec: 60, // Default time
          });

          allResults[question.id] = result.is_correct;
          if (result.is_correct) correctCount++;
        } catch (error) {
          console.error('Error submitting answer:', error);
          allResults[question.id] = false;
        }
      }

      // Update mastery once after all questions
      await updateMasteryMutation.mutateAsync({
        session_id: session.id,
      });
    } catch (error) {
      console.error('Error in diagnosis completion:', error);
    }

    setResults(allResults);

    // Trigger KSV update
    triggerKSVUpdate.mutate(courseId);

    // Get updated weak topics
    const weakTopics = ksvData
      ?.filter(ksv => ksv.knowledge_strength < 0.5)
      .map(ksv => ({
        topic_id: ksv.topic_id,
        topic_name: ksv.topic_name || 'Unknown',
        strength: ksv.knowledge_strength,
      })) || [];

    const diagnosisResults: DiagnosisResults = {
      questionsAnswered: questions.length,
      correctAnswers: correctCount,
      weakTopics: weakTopics.slice(0, 3),
      improvementRecommendations: [
        `Focus on ${weakTopics[0]?.topic_name || 'weak topics'}`,
        `Complete more practice questions in these areas`,
        `Review prerequisite concepts`,
      ],
    };

    setIsCompleted(true);
    if (onComplete) {
      onComplete(diagnosisResults);
    }
  };

  if (questionsLoading) {
    return <LoadingScreen message="Analyzing your knowledge state..." />;
  }

  if (!isDiagnosing && questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            5-Question Diagnosis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Take 5 targeted questions from your weakest topics to quickly identify knowledge gaps.
            This will update your personalized recommendations.
          </p>
          <Button onClick={handleStartDiagnosis} className="w-full" size="lg">
            <Activity className="w-4 h-4 mr-2" />
            Start Diagnosis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCompleted) {
    const currentQuestion = questions[currentIndex];
    const correctCount = Object.values(results).filter(Boolean).length;
    const accuracy = (correctCount / questions.length) * 100;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Diagnosis Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{correctCount}/{questions.length}</div>
            <div className="text-lg text-muted-foreground mb-4">
              {accuracy.toFixed(0)}% Accuracy
            </div>
            <Progress value={accuracy} className="h-3" />
          </div>

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Areas to Focus On:
            </h3>
            <div className="space-y-2">
              {questions
                .filter(q => !results[q.id])
                .map(q => (
                  <div key={q.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="font-medium text-sm">{q.topic_name}</p>
                    <p className="text-xs text-muted-foreground">Review this topic</p>
                  </div>
                ))}
            </div>
          </div>

          <Button
            onClick={() => {
              setIsDiagnosing(false);
              setIsCompleted(false);
              setQuestions([]);
              setAnswers({});
              setResults({});
              setCurrentIndex(0);
              triggerKSVUpdate.mutate(courseId);
            }}
            className="w-full"
            variant="outline"
          >
            Run Another Diagnosis
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Question {currentIndex + 1} of {questions.length}
          </span>
          <Badge variant="outline">{currentQuestion.topic_name}</Badge>
        </CardTitle>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-medium mb-4">{currentQuestion.prompt}</p>
          
          {currentQuestion.options ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => (
                <Button
                  key={idx}
                  variant={answers[currentQuestion.id] === option ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                placeholder="Type your answer..."
                className="w-full min-h-24 p-3 border rounded-lg"
              />
              <Button
                onClick={() => handleAnswer(currentQuestion.id, answers[currentQuestion.id] || '')}
                disabled={!answers[currentQuestion.id]?.trim()}
                className="w-full"
              >
                Next Question
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

