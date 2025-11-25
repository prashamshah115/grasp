import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface ExamTimerProps {
  durationMinutes: number
  startTime?: Date // Optional: if provided, calculates elapsed time
  timeRemainingSec?: number // Optional: if provided, uses this directly (for resuming exams)
  onTimeUp: () => void
  onTick?: (remainingSec: number) => void // Callback for each tick
  isPaused?: boolean
}

export function ExamTimer({
  durationMinutes,
  startTime,
  timeRemainingSec,
  onTimeUp,
  onTick,
  isPaused = false,
}: ExamTimerProps) {
  // Calculate initial seconds remaining
  const calculateInitialSeconds = () => {
    // If timeRemainingSec is provided (for resuming), use it directly
    if (timeRemainingSec !== undefined) {
      return Math.max(0, timeRemainingSec)
    }

    // Otherwise calculate from startTime
    if (startTime) {
      const totalSeconds = durationMinutes * 60
      const elapsedMs = Date.now() - new Date(startTime).getTime()
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      const remaining = totalSeconds - elapsedSeconds
      return Math.max(0, remaining)
    }

    // Default: full duration
    return durationMinutes * 60
  }

  const [secondsRemaining, setSecondsRemaining] = useState(calculateInitialSeconds)
  
  // Update timer if timeRemainingSec changes (e.g., on resume)
  useEffect(() => {
    if (timeRemainingSec !== undefined) {
      setSecondsRemaining(Math.max(0, timeRemainingSec))
    }
  }, [timeRemainingSec])

  useEffect(() => {
    if (isPaused || secondsRemaining <= 0) {
      if (secondsRemaining === 0) {
        onTimeUp()
      }
      return
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onTimeUp()
          if (onTick) onTick(0)
          return 0
        }
        const newValue = prev - 1
        if (onTick) onTick(newValue)
        return newValue
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [secondsRemaining, isPaused, onTimeUp])

  const hours = Math.floor(secondsRemaining / 3600)
  const minutes = Math.floor((secondsRemaining % 3600) / 60)
  const seconds = secondsRemaining % 60

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const percentageRemaining = (secondsRemaining / (durationMinutes * 60)) * 100

  // Color based on time remaining
  let timerColor = 'text-[#10B981]'
  let bgColor = 'bg-[#D1FAE5]'

  if (percentageRemaining < 25) {
    timerColor = 'text-[#EF4444]'
    bgColor = 'bg-[#FEE2E2]'
  } else if (percentageRemaining < 50) {
    timerColor = 'text-[#F59E0B]'
    bgColor = 'bg-[#FEF3C7]'
  }

  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-[12px] ${bgColor}`}>
      <Clock className={`w-5 h-5 ${timerColor}`} />
      <div className={`text-2xl font-medium tabular-nums ${timerColor}`}>{formatTime()}</div>
      {percentageRemaining < 10 && (
        <div className="text-xs text-[#EF4444] font-medium">Time's almost up!</div>
      )}
    </div>
  )
}
