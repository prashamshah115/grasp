/**
 * Load Testing Script for Edge Functions
 * Configurable concurrency, rate limit detection, latency tracking
 */

const config = require('./test-config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Statistics
const stats = {
  totalRequests: 0,
  successful: 0,
  failed: 0,
  rateLimited: 0,
  errors: [],
  latencies: [],
  memoryUsage: [],
  startTime: null,
  endTime: null,
};

// Helper: Get auth token
async function getAuthToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.testUser.email,
    password: config.testUser.password,
  });
  
  if (error) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: config.testUser.email,
      password: config.testUser.password,
    });
    
    if (signUpError) throw signUpError;
    return signUpData.session.access_token;
  }
  
  return data.session.access_token;
}

// Helper: Call Edge Function with timing
async function callEdgeFunction(functionName, body, token) {
  const start = Date.now();
  const memBefore = process.memoryUsage().heapUsed;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    const data = await response.json().catch(() => ({}));
    const latency = Date.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    
    return {
      status: response.status,
      data,
      latency,
      memoryDelta: memAfter - memBefore,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      status: 0,
      error: error.message,
      latency,
      memoryDelta: 0,
    };
  }
}

// Calculate percentiles
function calculatePercentiles(values, percentiles = [50, 95, 99]) {
  const sorted = [...values].sort((a, b) => a - b);
  const result = {};
  
  percentiles.forEach(p => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)] || 0;
  });
  
  return result;
}

// Run load test
async function runLoadTest(functionName, body, options = {}) {
  const {
    concurrency = 10,
    totalRequests = 100,
    token = null,
    delay = 0,
  } = options;
  
  console.log(`\n🚀 Starting Load Test: ${functionName}`);
  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Delay between batches: ${delay}ms\n`);
  
  stats.startTime = Date.now();
  stats.totalRequests = 0;
  stats.successful = 0;
  stats.failed = 0;
  stats.rateLimited = 0;
  stats.errors = [];
  stats.latencies = [];
  stats.memoryUsage = [];
  
  const authToken = token || await getAuthToken();
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - (batch * concurrency));
    const promises = [];
    
    for (let i = 0; i < batchSize; i++) {
      promises.push(callEdgeFunction(functionName, body, authToken));
    }
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      stats.totalRequests++;
      stats.latencies.push(result.latency);
      stats.memoryUsage.push(result.memoryDelta);
      
      if (result.status === 200) {
        stats.successful++;
      } else if (result.status === 429) {
        stats.rateLimited++;
      } else {
        stats.failed++;
        stats.errors.push({
          status: result.status,
          error: result.error || JSON.stringify(result.data),
        });
      }
    });
    
    // Progress update
    const progress = ((batch + 1) / batches * 100).toFixed(1);
    console.log(`   Progress: ${progress}% (${stats.totalRequests}/${totalRequests})`);
    
    // Delay between batches
    if (delay > 0 && batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  stats.endTime = Date.now();
  
  // Calculate statistics
  const duration = (stats.endTime - stats.startTime) / 1000;
  const rps = stats.totalRequests / duration;
  const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  const percentiles = calculatePercentiles(stats.latencies);
  const avgMemory = stats.memoryUsage.reduce((a, b) => a + b, 0) / stats.memoryUsage.length;
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Function: ${functionName}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`✅ Successful: ${stats.successful} (${(stats.successful / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${stats.failed} (${(stats.failed / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`🚫 Rate Limited: ${stats.rateLimited} (${(stats.rateLimited / stats.totalRequests * 100).toFixed(1)}%)`);
  console.log(`\n📈 Performance:`);
  console.log(`   Requests/sec: ${rps.toFixed(2)}`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`   p50 Latency: ${percentiles.p50.toFixed(2)}ms`);
  console.log(`   p95 Latency: ${percentiles.p95.toFixed(2)}ms`);
  console.log(`   p99 Latency: ${percentiles.p99.toFixed(2)}ms`);
  console.log(`   Avg Memory Delta: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (first 10):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   Status ${err.status}: ${err.error}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
  
  // Export to CSV
  const csvPath = path.join(__dirname, `load-test-${functionName}-${Date.now()}.csv`);
  const csvRows = [
    ['Request', 'Latency (ms)', 'Status', 'Memory Delta (bytes)'],
    ...stats.latencies.map((latency, i) => [
      i + 1,
      latency,
      i < stats.successful ? 200 : (i < stats.successful + stats.rateLimited ? 429 : 'error'),
      stats.memoryUsage[i] || 0,
    ]),
  ];
  
  const csv = csvRows.map(row => row.join(',')).join('\n');
  fs.writeFileSync(csvPath, csv);
  console.log(`📄 Results exported to: ${csvPath}\n`);
  
  return {
    functionName,
    duration,
    totalRequests: stats.totalRequests,
    successful: stats.successful,
    failed: stats.failed,
    rateLimited: stats.rateLimited,
    rps,
    avgLatency,
    percentiles,
    avgMemory,
    errors: stats.errors,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node load-test.js <function-name> [concurrency] [total-requests] [delay-ms]');
    console.log('\nExamples:');
    console.log('  node load-test.js rag-chat 10 100');
    console.log('  node load-test.js health-check 50 200 100');
    console.log('  node load-test.js generate-compression 5 20 1000');
    process.exit(1);
  }
  
  const functionName = args[0];
  const concurrency = parseInt(args[1]) || 10;
  const totalRequests = parseInt(args[2]) || 100;
  const delay = parseInt(args[3]) || 0;
  
  // Default body based on function
  let body = {};
  if (functionName === 'rag-chat') {
    body = {
      message: 'What is a process?',
      topicId: config.testData.topicId,
    };
  } else if (functionName === 'generate-compression') {
    body = {
      topicId: config.testData.topicId,
    };
  } else if (functionName === 'next-global-question') {
    body = {
      courseId: config.testData.courseId,
    };
  }
  
  await runLoadTest(functionName, body, {
    concurrency,
    totalRequests,
    delay,
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, callEdgeFunction };

