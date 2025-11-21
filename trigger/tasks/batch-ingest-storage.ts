import { task } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { parseStorageFiles, type ParsedFile } from '../utils/storage-parser';
import { ingestDocument } from './ingest-document';

interface BatchIngestStoragePayload {
  bucketName: string;
  folderPath?: string; // Optional: specific folder to process
  userId?: string; // Optional: specific user's folder
  dryRun?: boolean; // Test mode - don't actually ingest
}

interface BatchIngestStorageResult {
  success: true;
  filesFound: number;
  documentsCreated: number;
  ingestionsTriggered: number;
  errors: Array<{ file: string; error: string }>;
  stats: {
    withCourse: number;
    withTopic: number;
    withoutMetadata: number;
  };
}

/**
 * TASK: batch-ingest-storage
 * 
 * Scans Supabase Storage bucket, parses folder structure intelligently,
 * creates document records, and triggers ingestion for all PDF files.
 * 
 * Handles ANY folder structure gracefully - processes all files regardless.
 */
export const batchIngestStorage = task({
  id: "batch-ingest-storage",
  queue: {
    concurrencyLimit: 1 // Only one batch job at a time
  },
  retry: {
    maxAttempts: 2, // Batch jobs are expensive, retry once
    factor: 2,
    minTimeoutInMs: 30_000, // 30 seconds
    maxTimeoutInMs: 300_000, // 5 minutes
    randomize: true
  },
  run: async (payload: BatchIngestStoragePayload) => {
    const { bucketName, folderPath, userId, dryRun = false } = payload;

    console.log(`[batch-ingest-storage] ▶️  Starting batch ingestion`);
    console.log(`[batch-ingest-storage] Bucket: ${bucketName}, Folder: ${folderPath || 'root'}, User: ${userId || 'all'}, DryRun: ${dryRun}`);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const errors: Array<{ file: string; error: string }> = [];
    let documentsCreated = 0;
    let ingestionsTriggered = 0;
    const stats = {
      withCourse: 0,
      withTopic: 0,
      withoutMetadata: 0
    };

    try {
      // STEP 1: Recursively list all files in bucket/folder
      console.log(`[batch-ingest-storage] 📂 Listing files in bucket (recursive)...`);
      
      // Recursive function to list all files in subfolders
      async function listAllFilesRecursively(
        supabase: any,
        bucketName: string,
        prefix: string = '',
        allFiles: Array<{ name: string; id?: string }> = []
      ): Promise<Array<{ name: string; id?: string }>> {
        const { data: items, error } = await supabase.storage
          .from(bucketName)
          .list(prefix, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (error) {
          console.error(`[batch-ingest-storage] Error listing ${prefix}:`, error);
          return allFiles;
        }

        if (!items || items.length === 0) {
          return allFiles;
        }

        for (const item of items) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          
          // Check if it's likely a folder (no file extension)
          // Supabase Storage folders don't have metadata, so we check by extension
          const hasExtension = /\.\w+$/.test(item.name);
          
          if (!hasExtension) {
            // Likely a folder, recurse into it
            console.log(`[batch-ingest-storage] 📁 Entering folder: ${fullPath}`);
            await listAllFilesRecursively(supabase, bucketName, fullPath, allFiles);
          } else {
            // It's a file, add it
            allFiles.push({ name: fullPath, id: item.id });
          }
        }

        return allFiles;
      }

      // Determine starting prefix
      let startPrefix = '';
      if (userId) {
        startPrefix = folderPath ? `${userId}/${folderPath}` : `${userId}/`;
      } else if (folderPath) {
        startPrefix = folderPath;
      }

      const files = await listAllFilesRecursively(
        supabase,
        bucketName,
        startPrefix,
        []
      );

      if (files.length === 0) {
        console.log(`[batch-ingest-storage] ⚠️  No files found`);
        return {
          success: true,
          filesFound: 0,
          documentsCreated: 0,
          ingestionsTriggered: 0,
          errors: [],
          stats
        } as BatchIngestStorageResult;
      }

      console.log(`[batch-ingest-storage] ✅ Found ${files.length} files (recursive)`);

      // STEP 2: Parse files with smart folder structure detection
      console.log(`[batch-ingest-storage] 🧠 Parsing folder structure...`);
      const parseResult = await parseStorageFiles(supabase, files, bucketName, userId);

      console.log(`[batch-ingest-storage] 📊 Structure type: ${parseResult.structure.type}`);
      console.log(`[batch-ingest-storage] 📊 Parsed ${parseResult.files.length} PDF files`);

      // STEP 3: Process each file
      for (const parsedFile of parseResult.files) {
        try {
          // Skip if already processed (check if document exists)
          const { data: existingDoc } = await supabase
            .from('documents')
            .select('id, status')
            .eq('storage_path', parsedFile.path)
            .single();

          if (existingDoc) {
            console.log(`[batch-ingest-storage] ⏭️  Skipping ${parsedFile.fileName} (already exists)`);
            continue;
          }

          // Get signed URL
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(parsedFile.path, 3600);

          if (urlError || !signedUrlData) {
            throw new Error(`Failed to get signed URL: ${urlError?.message}`);
          }

          // Create document record
          const docData: any = {
            title: parsedFile.fileName,
            storage_path: parsedFile.path,
            doc_type: 'slides', // Default
            total_pages: 0,
            has_images: false,
            status: 'processing', // Valid status per database constraint (processing, ready, error)
            processing_step: dryRun ? null : 'waiting'
          };

          if (parsedFile.courseId) {
            docData.course_id = parsedFile.courseId;
            stats.withCourse++;
          }

          if (parsedFile.topicId) {
            docData.topic_id = parsedFile.topicId;
            stats.withTopic++;
          }

          if (!parsedFile.courseId && !parsedFile.topicId) {
            stats.withoutMetadata++;
          }

          if (userId) {
            docData.owner_user_id = userId;
          }

          if (dryRun) {
            console.log(`[batch-ingest-storage] 🔍 DRY RUN: Would create document for ${parsedFile.fileName}`);
            documentsCreated++;
            continue;
          }

          const { data: document, error: docError } = await supabase
            .from('documents')
            .insert(docData)
            .select('id, course_id, topic_id')
            .single();

          if (docError) {
            throw new Error(`Failed to create document: ${docError.message}`);
          }

          documentsCreated++;
          console.log(`[batch-ingest-storage] ✅ Created document ${document.id} for ${parsedFile.fileName}`);

          // STEP 4: Trigger ingestion (if not dry run)
          if (!dryRun && document) {
            try {
              // Use the ingestDocument task directly
              const ingestResult = await ingestDocument.trigger({
                documentId: document.id,
                pdfUrl: signedUrlData.signedUrl,
                courseId: document.course_id || '',
                topicId: document.topic_id || null,
                userId: userId || 'system'
              });

              ingestionsTriggered++;
              console.log(`[batch-ingest-storage] 🚀 Triggered ingestion for ${parsedFile.fileName} (run: ${ingestResult.id})`);
            } catch (triggerError: any) {
              console.error(`[batch-ingest-storage] ❌ Failed to trigger ingestion for ${parsedFile.fileName}:`, triggerError);
              errors.push({
                file: parsedFile.fileName,
                error: `Trigger failed: ${triggerError.message}`
              });
            }
          }

        } catch (fileError: any) {
          console.error(`[batch-ingest-storage] ❌ Error processing ${parsedFile.fileName}:`, fileError);
          errors.push({
            file: parsedFile.fileName,
            error: fileError.message || 'Unknown error'
          });
        }
      }

      console.log(`[batch-ingest-storage] 🎉 Batch ingestion complete!`);
      console.log(`[batch-ingest-storage] 📊 Stats: ${documentsCreated} documents, ${ingestionsTriggered} ingestions triggered, ${errors.length} errors`);

      return {
        success: true,
        filesFound: parseResult.files.length,
        documentsCreated,
        ingestionsTriggered,
        errors,
        stats
      } as BatchIngestStorageResult;

    } catch (error: any) {
      console.error(`[batch-ingest-storage] ❌ Fatal error:`, error);
      throw error;
    }
  }
});

