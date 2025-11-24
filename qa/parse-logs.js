/**
 * Log Parser and Error Extractor
 * Parses Supabase Function logs and extracts errors, warnings, and patterns
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');
const OUTPUT_FILE = path.join(__dirname, 'logs', 'parsed-errors.json');

// Parse log file
function parseLogFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { errors: [], warnings: [], slowQueries: [], patterns: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const errors = [];
  const warnings = [];
  const slowQueries = [];
  const patterns = {
    errorTypes: {},
    endpoints: {},
    timestamps: [],
  };
  
  lines.forEach((line, index) => {
    // Extract errors
    if (line.match(/error|exception|failed|fatal/i)) {
      errors.push({
        line: index + 1,
        content: line,
        timestamp: extractTimestamp(line),
        function: extractFunction(filePath),
      });
      
      // Categorize error type
      const errorType = categorizeError(line);
      patterns.errorTypes[errorType] = (patterns.errorTypes[errorType] || 0) + 1;
    }
    
    // Extract warnings
    if (line.match(/warn|warning|deprecated/i)) {
      warnings.push({
        line: index + 1,
        content: line,
        timestamp: extractTimestamp(line),
        function: extractFunction(filePath),
      });
    }
    
    // Extract slow queries (>5s)
    if (line.match(/duration|execution time|slow/i)) {
      const duration = extractDuration(line);
      if (duration && duration > 5000) {
        slowQueries.push({
          line: index + 1,
          content: line,
          duration,
          function: extractFunction(filePath),
        });
      }
    }
    
    // Extract endpoint patterns
    const endpoint = extractEndpoint(line);
    if (endpoint) {
      patterns.endpoints[endpoint] = (patterns.endpoints[endpoint] || 0) + 1;
    }
  });
  
  return { errors, warnings, slowQueries, patterns };
}

// Extract timestamp from log line
function extractTimestamp(line) {
  const match = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : null;
}

// Extract function name from file path
function extractFunction(filePath) {
  const basename = path.basename(filePath, '.log');
  return basename;
}

// Categorize error type
function categorizeError(line) {
  if (line.match(/timeout|timed out/i)) return 'timeout';
  if (line.match(/rate limit|429/i)) return 'rate_limit';
  if (line.match(/unauthorized|401|403/i)) return 'auth';
  if (line.match(/not found|404/i)) return 'not_found';
  if (line.match(/validation|invalid|400/i)) return 'validation';
  if (line.match(/database|sql|postgres/i)) return 'database';
  if (line.match(/openai|jina|api/i)) return 'external_api';
  if (line.match(/memory|heap/i)) return 'memory';
  return 'unknown';
}

// Extract duration from log line
function extractDuration(line) {
  const match = line.match(/(\d+(?:\.\d+)?)\s*(?:ms|s|seconds?|milliseconds?)/i);
  if (match) {
    let value = parseFloat(match[1]);
    if (line.match(/s|second/i)) value *= 1000;
    return value;
  }
  return null;
}

// Extract endpoint from log line
function extractEndpoint(line) {
  const match = line.match(/\/functions\/v1\/([a-z-]+)/i);
  return match ? match[1] : null;
}

// Main parsing function
function parseAllLogs() {
  console.log('🔍 Parsing Supabase Function Logs...\n');
  
  if (!fs.existsSync(LOG_DIR)) {
    console.error(`❌ Log directory not found: ${LOG_DIR}`);
    console.log('Run qa/audit-logs.sh first to fetch logs.');
    process.exit(1);
  }
  
  const allErrors = [];
  const allWarnings = [];
  const allSlowQueries = [];
  const allPatterns = {
    errorTypes: {},
    endpoints: {},
    functions: {},
  };
  
  // Parse each log file
  const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log') && f !== 'combined.log');
  
  if (files.length === 0) {
    console.error(`❌ No log files found in ${LOG_DIR}`);
    process.exit(1);
  }
  
  files.forEach(file => {
    const filePath = path.join(LOG_DIR, file);
    const parsed = parseLogFile(filePath);
    
    allErrors.push(...parsed.errors);
    allWarnings.push(...parsed.warnings);
    allSlowQueries.push(...parsed.slowQueries);
    
    // Aggregate patterns
    Object.keys(parsed.patterns.errorTypes).forEach(type => {
      allPatterns.errorTypes[type] = (allPatterns.errorTypes[type] || 0) + 
        parsed.patterns.errorTypes[type];
    });
    
    Object.keys(parsed.patterns.endpoints).forEach(endpoint => {
      allPatterns.endpoints[endpoint] = (allPatterns.endpoints[endpoint] || 0) + 
        parsed.patterns.endpoints[endpoint];
    });
    
    allPatterns.functions[parsed.function] = {
      errors: parsed.errors.length,
      warnings: parsed.warnings.length,
      slowQueries: parsed.slowQueries.length,
    };
  });
  
  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalErrors: allErrors.length,
    totalWarnings: allWarnings.length,
    totalSlowQueries: allSlowQueries.length,
    errorTypes: allPatterns.errorTypes,
    endpointUsage: allPatterns.endpoints,
    functionStats: allPatterns.functions,
    topErrors: allErrors.slice(0, 20),
    topWarnings: allWarnings.slice(0, 10),
    slowQueries: allSlowQueries.slice(0, 10),
  };
  
  // Save parsed results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  
  // Print summary
  console.log('📊 PARSING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Errors: ${summary.totalErrors}`);
  console.log(`Total Warnings: ${summary.totalWarnings}`);
  console.log(`Slow Queries: ${summary.totalSlowQueries}`);
  console.log('\nError Types:');
  Object.entries(summary.errorTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log('\nFunction Stats:');
  Object.entries(summary.functionStats).forEach(([func, stats]) => {
    console.log(`  ${func}: ${stats.errors} errors, ${stats.warnings} warnings, ${stats.slowQueries} slow queries`);
  });
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Parsed results saved to: ${OUTPUT_FILE}`);
  console.log('\nNext: Use qa/log-auditor-prompt.md with AI to analyze these errors.');
  
  return summary;
}

if (require.main === module) {
  parseAllLogs();
}

module.exports = { parseAllLogs, parseLogFile };

