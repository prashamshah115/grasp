import {
  ingestDocument
} from "./chunk-IMR7UK2M.mjs";
import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  task
} from "./chunk-F2S4DK4N.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// tasks/batch-ingest-storage.ts
init_esm();
var import_supabase_js = __toESM(require_main());

// utils/storage-parser.ts
init_esm();
function parseFolderPath(path) {
  const parts = path.split("/").filter((p) => p.length > 0);
  const result = {};
  if (parts.length >= 4 && parts[1] === "courses") {
    result.userId = parts[0];
    result.courseId = parts[2];
    result.topicId = parts[3];
    return result;
  }
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const secondPart = parts[1];
    const courseCodeMatch = firstPart.match(/^([A-Z]{2,4}\d{3,4})$/i);
    if (courseCodeMatch) {
      result.courseCode = courseCodeMatch[1].toUpperCase();
    }
    const weekTopicMatch = secondPart.match(/week[-_]?(\d+)[-_]?(.+)?/i) || secondPart.match(/^(\d+)[-_](.+)$/i) || secondPart.match(/^(\d+)$/);
    if (weekTopicMatch) {
      result.weekNumber = parseInt(weekTopicMatch[1], 10);
      if (weekTopicMatch[2]) {
        result.topicName = weekTopicMatch[2].trim().replace(/[-_]/g, " ");
      }
    } else {
      result.topicName = secondPart.replace(/[-_]/g, " ");
    }
  }
  if (parts.length === 1) {
    return {};
  }
  return result;
}
__name(parseFolderPath, "parseFolderPath");
async function matchCourse(supabase, courseCode, userId) {
  if (!courseCode) return null;
  const { data: exactMatch } = await supabase.from("courses").select("id").eq("code", courseCode.toUpperCase()).single();
  if (exactMatch) return exactMatch.id;
  const { data: caseMatch } = await supabase.from("courses").select("id").ilike("code", courseCode).single();
  if (caseMatch) return caseMatch.id;
  const { data: partialMatch } = await supabase.from("courses").select("id, code").or(`code.ilike.%${courseCode}%,code.ilike.${courseCode}%`).limit(1).single();
  if (partialMatch) return partialMatch.id;
  return null;
}
__name(matchCourse, "matchCourse");
async function matchOrCreateTopic(supabase, courseId, topicName, weekNumber, userId) {
  if (!courseId) return null;
  if (topicName) {
    const { data: nameMatch } = await supabase.from("topics").select("id").eq("course_id", courseId).ilike("name", `%${topicName}%`).single();
    if (nameMatch) return nameMatch.id;
  }
  if (weekNumber !== void 0) {
    const { data: weekMatch } = await supabase.from("topics").select("id").eq("course_id", courseId).eq("order_index", weekNumber).single();
    if (weekMatch) return weekMatch.id;
  }
  if (topicName || weekNumber !== void 0) {
    const { data: newTopic, error } = await supabase.from("topics").insert({
      course_id: courseId,
      name: topicName || `Week ${weekNumber}`,
      order_index: weekNumber || 0,
      description: `Auto-created from batch ingestion`
    }).select("id").single();
    if (!error && newTopic) {
      console.log(`[storage-parser] Created new topic: ${newTopic.id} for course ${courseId}`);
      return newTopic.id;
    }
  }
  return null;
}
__name(matchOrCreateTopic, "matchOrCreateTopic");
async function parseStorageFiles(supabase, files, bucketName = "user-content", defaultUserId) {
  const parsedFiles = [];
  const courseMatches = /* @__PURE__ */ new Map();
  const topicMatches = /* @__PURE__ */ new Map();
  const pdfFiles = files.filter(
    (f) => f.name.toLowerCase().endsWith(".pdf")
  );
  console.log(`[storage-parser] Processing ${pdfFiles.length} PDF files`);
  for (const file of pdfFiles) {
    const parsed = parseFolderPath(file.name);
    const fileName = file.name.split("/").pop() || file.name;
    const parsedFile = {
      path: file.name,
      fileName,
      ...parsed
    };
    if (parsed.courseCode && !parsed.courseId) {
      if (courseMatches.has(parsed.courseCode)) {
        parsedFile.courseId = courseMatches.get(parsed.courseCode);
      } else {
        const courseId = await matchCourse(supabase, parsed.courseCode, defaultUserId);
        if (courseId) {
          courseMatches.set(parsed.courseCode, courseId);
          parsedFile.courseId = courseId;
        }
      }
    }
    if (parsedFile.courseId && !parsedFile.topicId) {
      const topicKey = `${parsedFile.courseId}-${parsed.topicName || parsed.weekNumber || "default"}`;
      if (topicMatches.has(topicKey)) {
        parsedFile.topicId = topicMatches.get(topicKey).topicId;
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
    parsedFiles.push(parsedFile);
  }
  let structureType = "unknown";
  const hasCourseCode = parsedFiles.some((f) => f.courseCode);
  const hasUserId = parsedFiles.some((f) => f.userId);
  const hasNested = parsedFiles.some((f) => f.path.includes("/courses/"));
  const allFlat = parsedFiles.every((f) => !f.path.includes("/"));
  if (allFlat) {
    structureType = "flat";
  } else if (hasNested) {
    structureType = "nested";
  } else if (hasCourseCode) {
    structureType = "standard";
  } else if (hasCourseCode || hasUserId) {
    structureType = "mixed";
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
__name(parseStorageFiles, "parseStorageFiles");

// tasks/batch-ingest-storage.ts
var batchIngestStorage = task({
  id: "batch-ingest-storage",
  queue: {
    concurrencyLimit: 1
    // Only one batch job at a time
  },
  retry: {
    maxAttempts: 2,
    // Batch jobs are expensive, retry once
    factor: 2,
    minTimeoutInMs: 3e4,
    // 30 seconds
    maxTimeoutInMs: 3e5,
    // 5 minutes
    randomize: true
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { bucketName, folderPath, userId, dryRun = false } = payload;
    console.log(`[batch-ingest-storage] ▶️  Starting batch ingestion`);
    console.log(`[batch-ingest-storage] Bucket: ${bucketName}, Folder: ${folderPath || "root"}, User: ${userId || "all"}, DryRun: ${dryRun}`);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const errors = [];
    let documentsCreated = 0;
    let ingestionsTriggered = 0;
    const stats = {
      withCourse: 0,
      withTopic: 0,
      withoutMetadata: 0
    };
    try {
      console.log(`[batch-ingest-storage] 📂 Listing files in bucket (recursive)...`);
      async function listAllFilesRecursively(supabase2, bucketName2, prefix = "", allFiles = []) {
        const { data: items, error } = await supabase2.storage.from(bucketName2).list(prefix, {
          limit: 1e3,
          sortBy: { column: "name", order: "asc" }
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
          const hasExtension = /\.\w+$/.test(item.name);
          if (!hasExtension) {
            console.log(`[batch-ingest-storage] 📁 Entering folder: ${fullPath}`);
            await listAllFilesRecursively(supabase2, bucketName2, fullPath, allFiles);
          } else {
            allFiles.push({ name: fullPath, id: item.id });
          }
        }
        return allFiles;
      }
      __name(listAllFilesRecursively, "listAllFilesRecursively");
      let startPrefix = "";
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
        };
      }
      console.log(`[batch-ingest-storage] ✅ Found ${files.length} files (recursive)`);
      console.log(`[batch-ingest-storage] 🧠 Parsing folder structure...`);
      const parseResult = await parseStorageFiles(supabase, files, bucketName, userId);
      console.log(`[batch-ingest-storage] 📊 Structure type: ${parseResult.structure.type}`);
      console.log(`[batch-ingest-storage] 📊 Parsed ${parseResult.files.length} PDF files`);
      for (const parsedFile of parseResult.files) {
        try {
          const { data: existingDoc } = await supabase.from("documents").select("id, status").eq("storage_path", parsedFile.path).single();
          if (existingDoc) {
            console.log(`[batch-ingest-storage] ⏭️  Skipping ${parsedFile.fileName} (already exists)`);
            continue;
          }
          const { data: signedUrlData, error: urlError } = await supabase.storage.from(bucketName).createSignedUrl(parsedFile.path, 3600);
          if (urlError || !signedUrlData) {
            throw new Error(`Failed to get signed URL: ${urlError?.message}`);
          }
          const docData = {
            title: parsedFile.fileName,
            storage_path: parsedFile.path,
            doc_type: "slides",
            // Default
            total_pages: 0,
            has_images: false,
            status: "processing",
            // Valid status per database constraint (processing, ready, error)
            processing_step: dryRun ? null : "waiting"
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
          const { data: document, error: docError } = await supabase.from("documents").insert(docData).select("id, course_id, topic_id").single();
          if (docError) {
            throw new Error(`Failed to create document: ${docError.message}`);
          }
          documentsCreated++;
          console.log(`[batch-ingest-storage] ✅ Created document ${document.id} for ${parsedFile.fileName}`);
          if (!dryRun && document) {
            try {
              const ingestResult = await ingestDocument.trigger({
                documentId: document.id,
                pdfUrl: signedUrlData.signedUrl,
                courseId: document.course_id || "",
                topicId: document.topic_id || null,
                userId: userId || "system"
              });
              ingestionsTriggered++;
              console.log(`[batch-ingest-storage] 🚀 Triggered ingestion for ${parsedFile.fileName} (run: ${ingestResult.id})`);
            } catch (triggerError) {
              console.error(`[batch-ingest-storage] ❌ Failed to trigger ingestion for ${parsedFile.fileName}:`, triggerError);
              errors.push({
                file: parsedFile.fileName,
                error: `Trigger failed: ${triggerError.message}`
              });
            }
          }
        } catch (fileError) {
          console.error(`[batch-ingest-storage] ❌ Error processing ${parsedFile.fileName}:`, fileError);
          errors.push({
            file: parsedFile.fileName,
            error: fileError.message || "Unknown error"
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
      };
    } catch (error) {
      console.error(`[batch-ingest-storage] ❌ Fatal error:`, error);
      throw error;
    }
  }, "run")
});

export {
  batchIngestStorage
};
//# sourceMappingURL=chunk-5YNHB7Z2.mjs.map
