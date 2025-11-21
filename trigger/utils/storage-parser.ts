/**
 * Smart Storage Folder Parser
 * 
 * Handles ANY folder structure gracefully:
 * - Standard: {courseCode}/{week-topic}/{files.pdf}
 * - Flat: {files.pdf} (all in root)
 * - Nested: {userId}/courses/{courseId}/{topicId}/{files.pdf}
 * - Mixed: Any combination
 * 
 * Always processes ALL PDF files regardless of structure.
 */

export interface ParsedFile {
  path: string;
  fileName: string;
  courseCode?: string;
  weekNumber?: number;
  topicName?: string;
  userId?: string;
  courseId?: string;
  topicId?: string;
}

export interface ParseResult {
  files: ParsedFile[];
  structure: {
    type: 'standard' | 'flat' | 'nested' | 'mixed' | 'unknown';
    courseMatches: Map<string, string>; // courseCode -> courseId
    topicMatches: Map<string, { courseId: string; topicId: string }>;
  };
}

/**
 * Parse folder path to extract course/topic info
 * Handles multiple formats gracefully
 */
export function parseFolderPath(path: string): {
  courseCode?: string;
  weekNumber?: number;
  topicName?: string;
  userId?: string;
  courseId?: string;
  topicId?: string;
} {
  const parts = path.split('/').filter(p => p.length > 0);
  const result: any = {};

  // Pattern 1: {userId}/courses/{courseId}/{topicId}/{file}
  if (parts.length >= 4 && parts[1] === 'courses') {
    result.userId = parts[0];
    result.courseId = parts[2];
    result.topicId = parts[3];
    return result;
  }

  // Pattern 2: {courseCode}/{week-topic}/{file}
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const secondPart = parts[1];

    // Try to extract course code (alphanumeric, usually 3-10 chars)
    const courseCodeMatch = firstPart.match(/^([A-Z]{2,4}\d{3,4})$/i);
    if (courseCodeMatch) {
      result.courseCode = courseCodeMatch[1].toUpperCase();
    }

    // Try to extract week number and topic name
    // Formats: "week1-intro", "week-1-introduction", "1-intro", "week1"
    const weekTopicMatch = secondPart.match(/week[-_]?(\d+)[-_]?(.+)?/i) || 
                          secondPart.match(/^(\d+)[-_](.+)$/i) ||
                          secondPart.match(/^(\d+)$/);
    
    if (weekTopicMatch) {
      result.weekNumber = parseInt(weekTopicMatch[1], 10);
      if (weekTopicMatch[2]) {
        result.topicName = weekTopicMatch[2].trim().replace(/[-_]/g, ' ');
      }
    } else {
      // No week number, treat second part as topic name
      result.topicName = secondPart.replace(/[-_]/g, ' ');
    }
  }

  // Pattern 3: Flat structure (just filename)
  if (parts.length === 1) {
    // No structure info, will need to match by filename or use defaults
    return {};
  }

  return result;
}

/**
 * Match course code to database course
 * Tries multiple strategies
 */
export async function matchCourse(
  supabase: any,
  courseCode: string | undefined,
  userId?: string
): Promise<string | null> {
  if (!courseCode) return null;

  // Strategy 1: Exact match on code
  const { data: exactMatch } = await supabase
    .from('courses')
    .select('id')
    .eq('code', courseCode.toUpperCase())
    .single();

  if (exactMatch) return exactMatch.id;

  // Strategy 2: Case-insensitive match
  const { data: caseMatch } = await supabase
    .from('courses')
    .select('id')
    .ilike('code', courseCode)
    .single();

  if (caseMatch) return caseMatch.id;

  // Strategy 3: Partial match (if courseCode is substring)
  const { data: partialMatch } = await supabase
    .from('courses')
    .select('id, code')
    .or(`code.ilike.%${courseCode}%,code.ilike.${courseCode}%`)
    .limit(1)
    .single();

  if (partialMatch) return partialMatch.id;

  return null;
}

/**
 * Match or create topic
 * Tries to find existing topic, creates if not found
 */
export async function matchOrCreateTopic(
  supabase: any,
  courseId: string,
  topicName: string | undefined,
  weekNumber: number | undefined,
  userId?: string
): Promise<string | null> {
  if (!courseId) return null;

  // If we have topic name, try to match
  if (topicName) {
    const { data: nameMatch } = await supabase
      .from('topics')
      .select('id')
      .eq('course_id', courseId)
      .ilike('name', `%${topicName}%`)
      .single();

    if (nameMatch) return nameMatch.id;
  }

  // If we have week number, try to match by order_index
  if (weekNumber !== undefined) {
    const { data: weekMatch } = await supabase
      .from('topics')
      .select('id')
      .eq('course_id', courseId)
      .eq('order_index', weekNumber)
      .single();

    if (weekMatch) return weekMatch.id;
  }

  // Create new topic if we have enough info
  if (topicName || weekNumber !== undefined) {
    const { data: newTopic, error } = await supabase
      .from('topics')
      .insert({
        course_id: courseId,
        name: topicName || `Week ${weekNumber}`,
        order_index: weekNumber || 0,
        description: `Auto-created from batch ingestion`
      })
      .select('id')
      .single();

    if (!error && newTopic) {
      console.log(`[storage-parser] Created new topic: ${newTopic.id} for course ${courseId}`);
      return newTopic.id;
    }
  }

  return null;
}

/**
 * Smart file parser - processes ALL PDFs regardless of structure
 */
export async function parseStorageFiles(
  supabase: any,
  files: Array<{ name: string; id?: string }>,
  bucketName: string = 'user-content',
  defaultUserId?: string
): Promise<ParseResult> {
  const parsedFiles: ParsedFile[] = [];
  const courseMatches = new Map<string, string>();
  const topicMatches = new Map<string, { courseId: string; topicId: string }>();

  // Filter to PDFs only
  const pdfFiles = files.filter(f => 
    f.name.toLowerCase().endsWith('.pdf')
  );

  console.log(`[storage-parser] Processing ${pdfFiles.length} PDF files`);

  for (const file of pdfFiles) {
    const parsed = parseFolderPath(file.name);
    const fileName = file.name.split('/').pop() || file.name;

    const parsedFile: ParsedFile = {
      path: file.name,
      fileName,
      ...parsed
    };

    // Try to match course if we have courseCode
    if (parsed.courseCode && !parsed.courseId) {
      // Check cache first
      if (courseMatches.has(parsed.courseCode)) {
        parsedFile.courseId = courseMatches.get(parsed.courseCode)!;
      } else {
        const courseId = await matchCourse(supabase, parsed.courseCode, defaultUserId);
        if (courseId) {
          courseMatches.set(parsed.courseCode, courseId);
          parsedFile.courseId = courseId;
        }
      }
    }

    // Try to match/create topic if we have courseId
    if (parsedFile.courseId && !parsedFile.topicId) {
      const topicKey = `${parsedFile.courseId}-${parsed.topicName || parsed.weekNumber || 'default'}`;
      
      if (topicMatches.has(topicKey)) {
        parsedFile.topicId = topicMatches.get(topicKey)!.topicId;
      } else {
        const topicId = await matchOrCreateTopic(
          supabase,
          parsedFile.courseId,
          parsed.topicName,
          parsed.weekNumber,
          defaultUserId
        );
        if (topicId) {
          topicMatches.set(topicKey, { courseId: parsedFile.courseId, topicId });
          parsedFile.topicId = topicId;
        }
      }
    }

    // If we still don't have courseId/topicId, use defaults or skip
    // But we'll still process the file - it will be ingested with minimal metadata
    parsedFiles.push(parsedFile);
  }

  // Determine structure type
  let structureType: 'standard' | 'flat' | 'nested' | 'mixed' | 'unknown' = 'unknown';
  
  const hasCourseCode = parsedFiles.some(f => f.courseCode);
  const hasUserId = parsedFiles.some(f => f.userId);
  const hasNested = parsedFiles.some(f => f.path.includes('/courses/'));
  const allFlat = parsedFiles.every(f => !f.path.includes('/'));

  if (allFlat) {
    structureType = 'flat';
  } else if (hasNested) {
    structureType = 'nested';
  } else if (hasCourseCode) {
    structureType = 'standard';
  } else if (hasCourseCode || hasUserId) {
    structureType = 'mixed';
  }

  return {
    files: parsedFiles,
    structure: {
      type: structureType,
      courseMatches,
      topicMatches
    }
  };
}

