/**
 * HealthCheck Component - Phase 5
 * Browser-based health check UI for testing all API endpoints
 *
 * Usage: Add <HealthCheck /> to your app during development
 * Or access via console: window.__healthCheck()
 */

import { useState } from 'react'
import { runHealthChecks, type HealthCheckSummary } from '@/lib/health-check'
import { X, CheckCircle2, XCircle, MinusCircle, Play } from 'lucide-react'

export function HealthCheck() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [summary, setSummary] = useState<HealthCheckSummary | null>(null)

  const handleRunChecks = async () => {
    setIsRunning(true)
    try {
      const result = await runHealthChecks()
      setSummary(result)
    } catch (error) {
      console.error('Health check error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors z-50 text-sm font-medium"
      >
        🏥 Health Check
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-[600px] h-[600px] bg-white border border-gray-200 rounded-lg shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Backend Health Check</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleRunChecks}
          disabled={isRunning}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running Tests...' : 'Run Health Checks'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-xs text-gray-600">Passed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-xs text-gray-600">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">{summary.skipped}</div>
              <div className="text-xs text-gray-600">Skipped</div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!summary && !isRunning && (
          <div className="text-center text-gray-500 py-12">
            Click "Run Health Checks" to test all API endpoints
          </div>
        )}

        {isRunning && (
          <div className="text-center text-gray-500 py-12">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            Running health checks...
          </div>
        )}

        {summary && (
          <div className="space-y-2">
            {summary.results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border ${
                  result.status === 'pass'
                    ? 'bg-green-50 border-green-200'
                    : result.status === 'fail'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.status === 'pass' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  )}
                  {result.status === 'fail' && (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  {result.status === 'skip' && (
                    <MinusCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{result.name}</div>
                    {result.duration !== undefined && (
                      <div className="text-xs text-gray-500 mt-1">{result.duration}ms</div>
                    )}
                    {result.error && (
                      <div className="text-xs text-red-600 mt-1 font-mono break-all">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Make health check available globally for console access
if (typeof window !== 'undefined') {
  ;(window as any).__healthCheck = async () => {
    const result = await runHealthChecks()
    return result
  }
}
