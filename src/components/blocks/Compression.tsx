import { useState } from 'react';
import { BookMarked, Check } from 'lucide-react';

interface CompressionProps {
  onComplete: (cheatsheetEntry: string[]) => void;
}

export function Compression({ onComplete }: CompressionProps) {
  const [bullets, setBullets] = useState(['', '', '', '']);
  const [submitted, setSubmitted] = useState(false);
  const [finalEntry, setFinalEntry] = useState<string[]>([]);

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...bullets];
    newBullets[index] = value;
    setBullets(newBullets);
  };

  const handleSubmit = () => {
    if (bullets.every(b => b.trim())) {
      // Simulate AI refinement
      const refined = [
        'Page fault → CPU exception when accessing unmapped page',
        'OS loads page from disk → updates page table',
        'TLB caches recent translations for speed',
        'Instruction restarts after page loaded into RAM',
      ];
      setFinalEntry(refined);
      setSubmitted(true);
    }
  };

  const handleSave = () => {
    onComplete(finalEntry);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[#6B7280]">Compress what you learned into a memorable format</p>
      </div>

      {!submitted ? (
        <>
          {/* Prompt Card */}
          <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <h3 className="text-xl mb-4">
              Teach this back in exactly 4 bullet points:
            </h3>
            <p className="text-[#6B7280] mb-6">
              Paging → TLB → Page Fault
            </p>

            <div className="space-y-4">
              {bullets.map((bullet, index) => (
                <div key={index} className="flex gap-3">
                  <span className="text-[#6B7280] mt-3">•</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleBulletChange(index, e.target.value)}
                    placeholder={`Point ${index + 1}...`}
                    className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!bullets.every(b => b.trim())}
              className="w-full mt-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Final Cheatsheet Entry
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Final Cheatsheet Entry */}
          <div className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] mb-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BookMarked className="w-5 h-5 text-[#4F46E5]" />
              <h3 className="text-xl">Final Cheatsheet Entry</h3>
            </div>

            <div className="bg-[#4F46E5]/5 rounded-[12px] p-6 border border-[#4F46E5]/20 mb-6">
              <h4 className="mb-4">Paging & Page Faults</h4>
              <ul className="space-y-3">
                {finalEntry.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-[#4F46E5]">•</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[#22C55E]/10 rounded-[12px] border border-[#22C55E]/20 mb-6">
              <Check className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm mb-1">
                  <strong>Refined for clarity</strong>
                </p>
                <p className="text-sm text-[#6B7280]">
                  We've optimized your bullets to be exam-ready and memorable.
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 px-6 rounded-[12px] transition-colors"
            >
              Save to My Cheatsheet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
