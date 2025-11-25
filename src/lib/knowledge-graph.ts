/**
 * Knowledge Graph Helpers
 * 
 * Functions for working with course topic relationships:
 * - Prerequisites
 * - Dependencies
 * - Expanding weak topics
 */

import { supabase } from './supabase';

export interface GraphEdge {
  id: string;
  course_id: string;
  topic_a: string;
  topic_b: string;
  relation: 'prerequisite' | 'overlap' | 'dependent';
  confidence: number;
  weight: number;
}

export interface TopicWithPrereqs {
  topic_id: string;
  topic_name: string;
  relation: string;
  confidence: number;
}

/**
 * Get prerequisites for a topic
 * Returns topics that should be learned before this one
 */
export async function getPrerequisites(topicId: string): Promise<TopicWithPrereqs[]> {
  const { data, error } = await supabase
    .rpc('get_topic_prerequisites', { target_topic_id: topicId });
  
  if (error) {
    console.error('Error fetching prerequisites:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get dependents for a topic
 * Returns topics that depend on this one (learning this unlocks them)
 */
export async function getDependents(topicId: string): Promise<TopicWithPrereqs[]> {
  const { data, error } = await supabase
    .rpc('get_topic_dependents', { target_topic_id: topicId });
  
  if (error) {
    console.error('Error fetching dependents:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get all graph edges for a course
 */
export async function getCourseGraph(courseId: string): Promise<GraphEdge[]> {
  const { data, error } = await supabase
    .from('course_graph_edges')
    .select('*')
    .eq('course_id', courseId);
  
  if (error) {
    console.error('Error fetching course graph:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Expand weak topics by including their prerequisites
 * 
 * If a student is weak on topic C, but C depends on A and B,
 * they might need to review A and B first.
 */
export async function expandWeakTopics(
  weakTopicIds: string[],
  courseId: string
): Promise<string[]> {
  if (weakTopicIds.length === 0) return [];
  
  const expanded = new Set(weakTopicIds);
  
  // Get graph for the course
  const edges = await getCourseGraph(courseId);
  
  // Build adjacency list for prerequisites
  const prereqMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const prereqs = prereqMap.get(edge.topic_b) || [];
      prereqs.push(edge.topic_a);
      prereqMap.set(edge.topic_b, prereqs);
    }
  }
  
  // BFS to find all prerequisites of weak topics
  const queue = [...weakTopicIds];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const topicId = queue.shift()!;
    if (visited.has(topicId)) continue;
    visited.add(topicId);
    
    const prereqs = prereqMap.get(topicId) || [];
    for (const prereq of prereqs) {
      expanded.add(prereq);
      if (!visited.has(prereq)) {
        queue.push(prereq);
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * Get the learning path from one topic to another
 * Returns ordered list of topics to study
 */
export async function getTopicPath(
  fromTopicId: string,
  toTopicId: string,
  courseId: string
): Promise<string[]> {
  const edges = await getCourseGraph(courseId);
  
  // Build adjacency list
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const prereqs = graph.get(edge.topic_b) || [];
      prereqs.push(edge.topic_a);
      graph.set(edge.topic_b, prereqs);
    }
  }
  
  // BFS from target to find path through prerequisites
  const queue: string[][] = [[toTopicId]];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    
    if (current === fromTopicId) {
      return path.reverse();
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    const prereqs = graph.get(current) || [];
    for (const prereq of prereqs) {
      queue.push([...path, prereq]);
    }
  }
  
  // No path found
  return [fromTopicId, toTopicId];
}

/**
 * Calculate topic importance based on how many topics depend on it
 */
export async function getTopicImportance(
  courseId: string
): Promise<Map<string, number>> {
  const edges = await getCourseGraph(courseId);
  
  // Count incoming edges (dependents) for each topic
  const dependentCount = new Map<string, number>();
  
  for (const edge of edges) {
    if (edge.relation === 'prerequisite') {
      const count = dependentCount.get(edge.topic_a) || 0;
      dependentCount.set(edge.topic_a, count + 1);
    }
  }
  
  // Normalize to 0-1 range
  const maxCount = Math.max(...Array.from(dependentCount.values()), 1);
  const importance = new Map<string, number>();
  
  for (const [topicId, count] of dependentCount) {
    importance.set(topicId, count / maxCount);
  }
  
  return importance;
}

