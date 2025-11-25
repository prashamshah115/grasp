/**
 * Question Context Panel
 * 
 * Displays relevant knowledge objects for a question:
 * - Core concept
 * - Key formula
 * - Common mistakes
 * - Worked example
 * - Related practice (micro-drill)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Lightbulb, 
  FileText, 
  AlertTriangle, 
  BookOpen,
  Zap,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface QuestionContextPanelProps {
  topicId?: string;
  questionText?: string;
  courseId?: string;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

interface KnowledgeObject {
  id: string;
  object_type: 'concept' | 'formula' | 'example' | 'common_mistake' | 'micro_drill';
  title: string;
  summary: string;
  content: Record<string, unknown>;
}

const OBJECT_ICONS = {
  concept: Lightbulb,
  formula: FileText,
  example: BookOpen,
  common_mistake: AlertTriangle,
  micro_drill: Zap,
};

const OBJECT_COLORS = {
  concept: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  formula: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  example: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  common_mistake: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  micro_drill: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
};

const OBJECT_LABELS = {
  concept: 'Core Concept',
  formula: 'Key Formula',
  example: 'Worked Example',
  common_mistake: 'Common Mistake',
  micro_drill: 'Quick Practice',
};

export function QuestionContextPanel({
  topicId,
  questionText,
  courseId,
  onClose,
  isCollapsed = false,
  onToggle,
}: QuestionContextPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDrillAnswer, setShowDrillAnswer] = useState(false);

  // Fetch knowledge objects for this topic
  const { data: knowledgeObjects, isLoading } = useQuery({
    queryKey: ['knowledge-objects', topicId, courseId],
    queryFn: async (): Promise<KnowledgeObject[]> => {
      if (!topicId && !courseId) return [];

      let query = supabase
        .from('knowledge_objects')
        .select('id, object_type, title, summary, content');

      if (topicId) {
        query = query.eq('topic_id', topicId);
      } else if (courseId) {
        query = query.eq('course_id', courseId).limit(10);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge objects:', error);
        return [];
      }

      // Sort by type priority
      const typePriority = ['concept', 'formula', 'example', 'common_mistake', 'micro_drill'];
      return (data || []).sort((a, b) => 
        typePriority.indexOf(a.object_type) - typePriority.indexOf(b.object_type)
      );
    },
    enabled: !!(topicId || courseId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setShowDrillAnswer(false);
  };

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-10"
        onClick={onToggle}
      >
        <Lightbulb className="w-4 h-4 mr-1" />
        Help
      </Button>
    );
  }

  return (
    <Card className="w-80 h-full border-l rounded-none shadow-none">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Study Context</CardTitle>
        <div className="flex items-center gap-1">
          {onToggle && (
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-4 pb-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : knowledgeObjects && knowledgeObjects.length > 0 ? (
              knowledgeObjects.map((obj) => (
                <KnowledgeCard
                  key={obj.id}
                  object={obj}
                  isExpanded={expandedId === obj.id}
                  onToggle={() => toggleExpand(obj.id)}
                  showDrillAnswer={showDrillAnswer}
                  onShowDrillAnswer={() => setShowDrillAnswer(true)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No study materials available for this topic yet.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface KnowledgeCardProps {
  object: KnowledgeObject;
  isExpanded: boolean;
  onToggle: () => void;
  showDrillAnswer: boolean;
  onShowDrillAnswer: () => void;
}

function KnowledgeCard({ 
  object, 
  isExpanded, 
  onToggle,
  showDrillAnswer,
  onShowDrillAnswer,
}: KnowledgeCardProps) {
  const Icon = OBJECT_ICONS[object.object_type];
  const colorClass = OBJECT_COLORS[object.object_type];
  const label = OBJECT_LABELS[object.object_type];

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer ${
        isExpanded ? 'bg-accent/50' : 'hover:bg-accent/30'
      }`}
      onClick={onToggle}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {label}
              </Badge>
            </div>
            <p className="font-medium text-sm truncate">{object.title}</p>
            {!isExpanded && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {object.summary}
              </p>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`} />
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-muted-foreground mb-3">{object.summary}</p>
            
            <KnowledgeContent 
              type={object.object_type}
              content={object.content}
              showDrillAnswer={showDrillAnswer}
              onShowDrillAnswer={onShowDrillAnswer}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface KnowledgeContentProps {
  type: KnowledgeObject['object_type'];
  content: Record<string, unknown>;
  showDrillAnswer: boolean;
  onShowDrillAnswer: () => void;
}

function KnowledgeContent({ type, content, showDrillAnswer, onShowDrillAnswer }: KnowledgeContentProps) {
  switch (type) {
    case 'concept':
      return (
        <div className="space-y-2 text-sm">
          {content.definition && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Definition</p>
              <p>{content.definition as string}</p>
            </div>
          )}
          {content.intuition && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Intuition</p>
              <p className="text-muted-foreground">{content.intuition as string}</p>
            </div>
          )}
          {content.key_points && Array.isArray(content.key_points) && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Key Points</p>
              <ul className="list-disc list-inside space-y-1">
                {(content.key_points as string[]).map((point, i) => (
                  <li key={i} className="text-muted-foreground">{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'formula':
      return (
        <div className="space-y-2 text-sm">
          {content.plain && (
            <div className="p-2 bg-muted rounded font-mono text-sm">
              {content.plain as string}
            </div>
          )}
          {content.variables && typeof content.variables === 'object' && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Variables</p>
              <div className="space-y-1">
                {Object.entries(content.variables as Record<string, string>).map(([key, desc]) => (
                  <p key={key} className="text-muted-foreground">
                    <code className="bg-muted px-1 rounded">{key}</code>: {desc}
                  </p>
                ))}
              </div>
            </div>
          )}
          {content.when_to_use && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">When to Use</p>
              <p className="text-muted-foreground">{content.when_to_use as string}</p>
            </div>
          )}
        </div>
      );

    case 'example':
      return (
        <div className="space-y-2 text-sm">
          {content.problem && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Problem</p>
              <p>{content.problem as string}</p>
            </div>
          )}
          {content.solution_steps && Array.isArray(content.solution_steps) && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Solution</p>
              <ol className="list-decimal list-inside space-y-1">
                {(content.solution_steps as string[]).map((step, i) => (
                  <li key={i} className="text-muted-foreground">{step}</li>
                ))}
              </ol>
            </div>
          )}
          {content.final_answer && (
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <p className="font-medium text-xs text-green-700 dark:text-green-300 mb-1">Answer</p>
              <p className="text-green-600 dark:text-green-400">{content.final_answer as string}</p>
            </div>
          )}
        </div>
      );

    case 'common_mistake':
      return (
        <div className="space-y-2 text-sm">
          {content.mistake && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">The Mistake</p>
              <p className="text-red-600 dark:text-red-400">{content.mistake as string}</p>
            </div>
          )}
          {content.why_wrong && (
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">Why It's Wrong</p>
              <p className="text-muted-foreground">{content.why_wrong as string}</p>
            </div>
          )}
          {content.correct_approach && (
            <div>
              <p className="font-medium text-xs text-green-600 dark:text-green-400 mb-1">Correct Approach</p>
              <p>{content.correct_approach as string}</p>
            </div>
          )}
        </div>
      );

    case 'micro_drill':
      return (
        <div className="space-y-2 text-sm">
          {content.question && (
            <div>
              <p className="font-medium">{content.question as string}</p>
            </div>
          )}
          {content.hint && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                💡 Hint: {content.hint as string}
              </p>
            </div>
          )}
          {content.answer && (
            showDrillAnswer ? (
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Answer</p>
                <p className="text-green-600 dark:text-green-400">{content.answer as string}</p>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDrillAnswer();
                }}
              >
                Show Answer
              </Button>
            )
          )}
        </div>
      );

    default:
      return null;
  }
}

export default QuestionContextPanel;
