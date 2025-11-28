/**
 * KnowledgeGraphViewer Component
 * 
 * Displays topic relationships in a visual graph format.
 * Shows prerequisites, dependencies, and overlaps between topics.
 */

import { useState } from 'react';
import { 
  Network, 
  ArrowRight, 
  ArrowLeftRight, 
  GitBranch, 
  RefreshCw, 
  Loader2,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCourseGraph, useConcepts, useFormulas, useTriggerKnowledgeGraph } from '@/hooks/useKnowledgeGraph';

interface KnowledgeGraphViewerProps {
  courseId: string;
  courseName?: string;
}

export function KnowledgeGraphViewer({ courseId, courseName }: KnowledgeGraphViewerProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  
  const { data: graphEdges, isLoading: graphLoading, refetch: refetchGraph } = useCourseGraph(courseId);
  const { data: concepts, isLoading: conceptsLoading } = useConcepts(courseId);
  const { data: formulas, isLoading: formulasLoading } = useFormulas(courseId);
  const triggerKnowledgeGraph = useTriggerKnowledgeGraph();

  const isLoading = graphLoading || conceptsLoading || formulasLoading;
  const hasNoData = (!graphEdges || graphEdges.length === 0) && 
                    (!concepts || concepts.length === 0) && 
                    (!formulas || formulas.length === 0);

  const handleGenerateGraph = async () => {
    try {
      await triggerKnowledgeGraph.mutateAsync(courseId);
      // Refetch after a delay to check for new data
      setTimeout(() => refetchGraph(), 5000);
    } catch (error) {
      console.error('Failed to trigger knowledge graph generation:', error);
    }
  };

  // Group edges by relationship type
  const prerequisites = graphEdges?.filter(e => e.relationship_type === 'prerequisite') || [];
  const overlaps = graphEdges?.filter(e => e.relationship_type === 'overlap') || [];
  const dependencies = graphEdges?.filter(e => e.relationship_type === 'dependent') || [];

  // Group concepts by topic
  const conceptsByTopic = new Map<string, typeof concepts>();
  concepts?.forEach(c => {
    const topicId = c.topic_id;
    if (topicId) {
      const existing = conceptsByTopic.get(topicId) || [];
      existing.push(c);
      conceptsByTopic.set(topicId, existing);
    }
  });

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'prerequisite':
        return <ArrowRight className="w-4 h-4 text-[#4F46E5]" />;
      case 'overlap':
        return <ArrowLeftRight className="w-4 h-4 text-[#F59E0B]" />;
      case 'dependent':
        return <GitBranch className="w-4 h-4 text-[#10B981]" />;
      default:
        return <Network className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getRelationshipColor = (type: string) => {
    switch (type) {
      case 'prerequisite':
        return 'bg-[#EEF2FF] border-[#4F46E5]/20 text-[#4F46E5]';
      case 'overlap':
        return 'bg-[#FEF3C7] border-[#F59E0B]/20 text-[#F59E0B]';
      case 'dependent':
        return 'bg-[#D1FAE5] border-[#10B981]/20 text-[#10B981]';
      default:
        return 'bg-[#F3F4F6] border-[#6B7280]/20 text-[#6B7280]';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
            <Network className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <div>
            <h3 className="text-lg font-medium">Knowledge Graph</h3>
            <p className="text-sm text-[#6B7280]">
              {courseName || 'Course'} - Topic Relationships
            </p>
          </div>
        </div>
        
        <button
          onClick={handleGenerateGraph}
          disabled={triggerKnowledgeGraph.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 text-sm"
        >
          {triggerKnowledgeGraph.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {triggerKnowledgeGraph.isPending ? 'Generating...' : 'Refresh Graph'}
        </button>
      </div>

      {/* Empty State */}
      {hasNoData && (
        <div className="p-12 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-center">
          <Network className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
          <h4 className="text-lg font-medium mb-2">No Knowledge Graph Yet</h4>
          <p className="text-[#6B7280] mb-6 max-w-md mx-auto">
            Upload course materials and click "Refresh Graph" to automatically generate topic relationships, concepts, and formulas.
          </p>
          <button
            onClick={handleGenerateGraph}
            disabled={triggerKnowledgeGraph.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50"
          >
            {triggerKnowledgeGraph.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            Generate Knowledge Graph
          </button>
        </div>
      )}

      {/* Topic Relationships */}
      {graphEdges && graphEdges.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[#6B7280] uppercase tracking-wider">
            Topic Relationships
          </h4>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 p-4 bg-[#F9FAFB] rounded-lg">
            <div className="flex items-center gap-2">
              {getRelationshipIcon('prerequisite')}
              <span className="text-sm">Prerequisite</span>
            </div>
            <div className="flex items-center gap-2">
              {getRelationshipIcon('overlap')}
              <span className="text-sm">Overlap</span>
            </div>
            <div className="flex items-center gap-2">
              {getRelationshipIcon('dependent')}
              <span className="text-sm">Dependent</span>
            </div>
          </div>

          {/* Prerequisites */}
          {prerequisites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Prerequisites ({prerequisites.length})</p>
              <div className="space-y-2">
                {prerequisites.map((edge, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getRelationshipColor('prerequisite')}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{edge.topic_a_data?.name || 'Topic A'}</span>
                      <ArrowRight className="w-4 h-4" />
                      <span className="font-medium">{edge.topic_b_data?.name || 'Topic B'}</span>
                    </div>
                    {edge.explanation && (
                      <p className="text-sm mt-1 opacity-80">{edge.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overlaps */}
          {overlaps.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Overlapping Topics ({overlaps.length})</p>
              <div className="space-y-2">
                {overlaps.map((edge, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getRelationshipColor('overlap')}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{edge.topic_a_data?.name || 'Topic A'}</span>
                      <ArrowLeftRight className="w-4 h-4" />
                      <span className="font-medium">{edge.topic_b_data?.name || 'Topic B'}</span>
                    </div>
                    {edge.explanation && (
                      <p className="text-sm mt-1 opacity-80">{edge.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {dependencies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Dependencies ({dependencies.length})</p>
              <div className="space-y-2">
                {dependencies.map((edge, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getRelationshipColor('dependent')}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{edge.topic_a_data?.name || 'Topic A'}</span>
                      <GitBranch className="w-4 h-4" />
                      <span className="font-medium">{edge.topic_b_data?.name || 'Topic B'}</span>
                    </div>
                    {edge.explanation && (
                      <p className="text-sm mt-1 opacity-80">{edge.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Concepts & Formulas Summary */}
      {(concepts && concepts.length > 0) || (formulas && formulas.length > 0) ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Concepts */}
          <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-[#4F46E5]" />
              <span className="font-medium">Concepts</span>
              <span className="text-sm text-[#6B7280]">({concepts?.length || 0})</span>
            </div>
            <div className="space-y-1">
              {concepts?.slice(0, 5).map((concept, idx) => (
                <div key={idx} className="text-sm p-2 bg-white rounded-lg">
                  <span className="font-medium">{concept.title}</span>
                  {concept.importance && (
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      concept.importance === 'critical' ? 'bg-[#FEE2E2] text-[#EF4444]' :
                      concept.importance === 'high' ? 'bg-[#FEF3C7] text-[#F59E0B]' :
                      'bg-[#E5E7EB] text-[#6B7280]'
                    }`}>
                      {concept.importance}
                    </span>
                  )}
                </div>
              ))}
              {concepts && concepts.length > 5 && (
                <button
                  onClick={() => setExpandedTopic(expandedTopic === 'concepts' ? null : 'concepts')}
                  className="text-sm text-[#4F46E5] hover:underline flex items-center gap-1"
                >
                  {expandedTopic === 'concepts' ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Show {concepts.length - 5} more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
              {expandedTopic === 'concepts' && concepts?.slice(5).map((concept, idx) => (
                <div key={idx} className="text-sm p-2 bg-white rounded-lg">
                  <span className="font-medium">{concept.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Formulas */}
          <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">∑</span>
              <span className="font-medium">Formulas</span>
              <span className="text-sm text-[#6B7280]">({formulas?.length || 0})</span>
            </div>
            <div className="space-y-1">
              {formulas?.slice(0, 5).map((formula, idx) => (
                <div key={idx} className="text-sm p-2 bg-white rounded-lg">
                  <span className="font-medium">{formula.name}</span>
                  {formula.formula_latex && (
                    <p className="font-mono text-xs text-[#6B7280] mt-1 truncate">
                      {formula.formula_latex}
                    </p>
                  )}
                </div>
              ))}
              {formulas && formulas.length > 5 && (
                <button
                  onClick={() => setExpandedTopic(expandedTopic === 'formulas' ? null : 'formulas')}
                  className="text-sm text-[#4F46E5] hover:underline flex items-center gap-1"
                >
                  {expandedTopic === 'formulas' ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Show {formulas.length - 5} more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
              {expandedTopic === 'formulas' && formulas?.slice(5).map((formula, idx) => (
                <div key={idx} className="text-sm p-2 bg-white rounded-lg">
                  <span className="font-medium">{formula.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default KnowledgeGraphViewer;


