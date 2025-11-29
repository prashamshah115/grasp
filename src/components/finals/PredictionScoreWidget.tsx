/**
 * Prediction Score Widget
 * 
 * Shows predicted final exam score based on KSV analysis
 * Displays improvement potential and fixable topics
 */

import { TrendingUp, Target, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePredictionScore } from '@/hooks/useKnowledgeState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PredictionScoreWidgetProps {
  courseId: string;
}

export function PredictionScoreWidget({ courseId }: PredictionScoreWidgetProps) {
  const { data: prediction, isLoading } = usePredictionScore(courseId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prediction Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return null;
  }

  const { predicted_score, improvement_potential, fixable_topics } = prediction;

  // Color coding based on score
  const scoreColor =
    predicted_score >= 80
      ? 'text-green-600'
      : predicted_score >= 70
      ? 'text-yellow-600'
      : predicted_score >= 60
      ? 'text-orange-600'
      : 'text-red-600';

  const bgColor =
    predicted_score >= 80
      ? 'bg-green-50'
      : predicted_score >= 70
      ? 'bg-yellow-50'
      : predicted_score >= 60
      ? 'bg-orange-50'
      : 'bg-red-50';

  return (
    <Card className={`border-2 ${bgColor}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          Prediction Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${scoreColor}`}>
              {predicted_score}%
            </span>
            <span className="text-sm text-muted-foreground">
              if final was today
            </span>
          </div>
          <Progress value={predicted_score} className="h-2" />
        </div>

        {/* Improvement Potential */}
        {improvement_potential > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">
                Potential Improvement
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              +{improvement_potential}%
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {fixable_topics.length > 0
                ? `Fix ${fixable_topics.length} topics to improve`
                : 'Focus on weak topics to improve'}
            </p>
          </div>
        )}

        {/* Fixable Topics */}
        {fixable_topics.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Top Fixable Topics:
            </p>
            <div className="space-y-2">
              {fixable_topics.map((topic, idx) => (
                <div
                  key={topic.topic_id}
                  className="flex items-center justify-between p-2 bg-white rounded border"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Badge variant="outline" className="text-xs">
                      #{idx + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {topic.topic_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      +{topic.potential_gain}%
                    </span>
                    <div className="w-16">
                      <Progress
                        value={topic.current_strength * 100}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {predicted_score < 70 && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800">
              Your predicted score is below 70%. Focus on reviewing prerequisite
              topics and completing more practice questions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

