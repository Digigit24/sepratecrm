// src/components/crm/LeadScoreSlider.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LeadScoreSliderProps {
  score: number;
  onSave: (score: number) => Promise<void>;
  leadName: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const getScoreEmoji = (score: number): string => {
  if (score <= 20) return '😴';
  if (score <= 40) return '😐';
  if (score <= 60) return '🙂';
  if (score <= 80) return '😊';
  return '🔥';
};

const getScoreLabel = (score: number): string => {
  if (score <= 20) return 'Cold';
  if (score <= 40) return 'Low';
  if (score <= 60) return 'Warm';
  if (score <= 80) return 'Hot';
  return 'Very Hot';
};

const getScoreColor = (score: number): string => {
  if (score <= 20) return 'text-slate-500 bg-slate-100 border-slate-200';
  if (score <= 40) return 'text-blue-500 bg-blue-50 border-blue-200';
  if (score <= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (score <= 80) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

export const LeadScoreSlider: React.FC<LeadScoreSliderProps> = ({
  score = 0,
  onSave,
  leadName,
  size = 'md',
  showLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayScore, setDisplayScore] = useState(score);
  const [isSaving, setIsSaving] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasChanged = useRef(false);
  const originalScore = useRef(score);

  // Update display score when prop changes
  useEffect(() => {
    setDisplayScore(score);
    originalScore.current = score;
  }, [score]);

  const handleScoreChange = useCallback((newScore: number) => {
    const clampedScore = Math.max(0, Math.min(100, Math.round(newScore)));
    setDisplayScore(clampedScore);
    hasChanged.current = clampedScore !== originalScore.current;
  }, []);

  const saveScore = useCallback(async (finalScore: number) => {
    if (!hasChanged.current || isSaving) return;
    
    try {
      setIsSaving(true);
      // Optimistic update - already showing the new score
      await onSave(finalScore);
      originalScore.current = finalScore;
      hasChanged.current = false;
      toast.success(`Lead score updated for ${leadName}`);
    } catch (error) {
      // Revert on error
      setDisplayScore(originalScore.current);
      toast.error('Failed to update lead score');
    } finally {
      setIsSaving(false);
    }
  }, [onSave, leadName, isSaving]);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    // Auto-save when drag ends
    if (hasChanged.current) {
      saveScore(displayScore);
    }
  }, [displayScore, saveScore]);

  // Handle click on slider track
  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const percentage = 1 - (y / height);
    const newScore = Math.max(0, Math.min(100, Math.round(percentage * 100)));
    
    handleScoreChange(newScore);
    // Auto-save on click
    saveScore(newScore);
  }, [handleScoreChange, saveScore]);

  // Handle mouse/touch drag
  const handleDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current || !sliderRef.current) return;
    e.preventDefault();
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const y = clientY - rect.top;
    const height = rect.height;
    const percentage = 1 - (y / height);
    handleScoreChange(percentage * 100);
  }, [handleScoreChange]);

  // Add global mouse/touch listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e);
    const handleUp = () => handleDragEnd();

    if (isOpen) {
      document.addEventListener('mousemove', handleMove, { passive: false });
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isOpen, handleDragMove, handleDragEnd]);

  const getScoreTextColor = (s: number): string => {
    if (s <= 20) return 'text-slate-500';
    if (s <= 40) return 'text-blue-500';
    if (s <= 60) return 'text-yellow-600';
    if (s <= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'text-sm font-medium hover:underline cursor-pointer bg-transparent border-none p-0',
            getScoreTextColor(score)
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          {score > 0 ? score : '-'}
        </button>
      </PopoverTrigger>
      
      <PopoverContent
        className="w-auto p-1.5"
        align="center"
        side="bottom"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {/* Score Display */}
          <div className="flex flex-col items-center min-w-[36px]">
            <span className="text-xl">{getScoreEmoji(displayScore)}</span>
            <span className="text-base font-bold leading-tight">{displayScore}</span>
            <span className="text-[9px] text-muted-foreground leading-tight">{getScoreLabel(displayScore)}</span>
          </div>

          {/* Vertical Slider - Compact */}
          <div
            ref={sliderRef}
            className="relative w-6 h-[120px] bg-secondary rounded-full cursor-pointer touch-none select-none"
            onClick={handleTrackClick}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            {/* Background gradient */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-full transition-all duration-75"
              style={{
                height: `${displayScore}%`,
                background: `linear-gradient(to top,
                  ${displayScore > 80 ? '#ef4444' : displayScore > 60 ? '#f97316' : displayScore > 40 ? '#eab308' : displayScore > 20 ? '#3b82f6' : '#64748b'},
                  ${displayScore > 80 ? '#fca5a5' : displayScore > 60 ? '#fdba74' : displayScore > 40 ? '#fde047' : displayScore > 20 ? '#93c5fd' : '#cbd5e1'}
                )`,
              }}
            />

            {/* Thumb handle */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-md border-2 border-primary flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-75 hover:scale-110"
              style={{
                bottom: `calc(${displayScore}% - 10px)`,
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <span className="text-[10px]">{getScoreEmoji(displayScore)}</span>
            </div>
          </div>

          {/* Quick select buttons - Compact */}
          <div className="flex flex-col gap-0.5">
            {[100, 75, 50, 25, 0].map((value) => (
              <Button
                key={value}
                variant={displayScore === value ? 'default' : 'ghost'}
                size="sm"
                className="h-5 px-1 text-[10px] min-w-[24px] py-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleScoreChange(value);
                  saveScore(value);
                }}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LeadScoreSlider;
