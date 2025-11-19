import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface ExamTimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
  isPaused?: boolean;
}

export function ExamTimer({ durationMinutes, onTimeUp, isPaused = false }: ExamTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);

  useEffect(() => {
    if (isPaused || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, isPaused, onTimeUp]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const percentageRemaining = (secondsRemaining / (durationMinutes * 60)) * 100;
  
  // Color based on time remaining
  let timerColor = 'text-[#10B981]';
  let bgColor = 'bg-[#D1FAE5]';
  
  if (percentageRemaining < 25) {
    timerColor = 'text-[#EF4444]';
    bgColor = 'bg-[#FEE2E2]';
  } else if (percentageRemaining < 50) {
    timerColor = 'text-[#F59E0B]';
    bgColor = 'bg-[#FEF3C7]';
  }

  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-[12px] ${bgColor}`}>
      <Clock className={`w-5 h-5 ${timerColor}`} />
      <div className={`text-2xl font-medium tabular-nums ${timerColor}`}>
        {formatTime()}
      </div>
      {percentageRemaining < 10 && (
        <div className="text-xs text-[#EF4444] font-medium">
          Time's almost up!
        </div>
      )}
    </div>
  );
}
