import { ArrowLeft } from 'lucide-react';
import type { ConceptNode } from '@/types/legacy';

interface CheatsheetProps {
  concepts: ConceptNode[];
  onBack: () => void;
}

export function Cheatsheet({ concepts, onBack }: CheatsheetProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl tracking-tight">grasp.ai</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-16">
          <h1 className="text-5xl mb-4 tracking-tight">
            Your Finals Cheatsheet
          </h1>
          <p className="text-lg text-[#6B7280]">
            Compressed knowledge — ready for exam day
          </p>
        </div>

        {/* Concept Blocks */}
        <div className="space-y-8">
          {concepts.map((concept, index) => (
            <div
              key={index}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-8"
            >
              {/* Concept Header */}
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-2xl">{concept.name}</h2>
                {concept.masteryLevel && (
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      concept.masteryLevel >= 80
                        ? 'bg-[#DCFCE7] text-[#166534]'
                        : concept.masteryLevel >= 60
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {concept.masteryLevel}% mastered
                  </span>
                )}
              </div>

              {/* Key Points */}
              <div className="space-y-3 mb-6">
                {concept.keyPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-2 flex-shrink-0" />
                    <div className="text-[#111827]">{point}</div>
                  </div>
                ))}
              </div>

              {/* Common Mistake */}
              {concept.commonMistake && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[12px] p-4">
                  <div className="text-sm text-[#991B1B] mb-1">⚠️ Common Mistake</div>
                  <div className="text-sm text-[#991B1B]">{concept.commonMistake}</div>
                </div>
              )}

              {/* Visual Aid */}
              {concept.visualAid && (
                <div className="mt-6 bg-[#F9FAFB] rounded-[12px] p-6">
                  <div className="text-sm text-[#6B7280] mb-3">Visual Aid</div>
                  <pre className="text-xs text-[#111827] font-mono whitespace-pre-wrap">
                    {concept.visualAid}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
