import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { whatsappClient } from '@/lib/whatsappClient';

interface VoiceMessagePlayerProps {
  src: string;
  isOutgoing?: boolean;
}

// Generate a stable pseudo-random waveform for a given src string
function generateWaveform(seed: string, bars = 40): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Array.from({ length: bars }, (_, i) => {
    const val = Math.abs(Math.sin(hash * (i + 1) * 0.3 + i * 0.7) * 0.8 + Math.sin(i * 0.5) * 0.2);
    // Taper at the edges, peak in the middle area
    const taper = Math.sin((i / bars) * Math.PI);
    return Math.max(0.1, Math.min(1, val * 0.6 + taper * 0.4));
  });
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ src, isOutgoing = false }) => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const waveform = useMemo(() => generateWaveform(src), [src]);

  // Fetch audio with auth
  useEffect(() => {
    let cancelled = false;

    const fetchAudio = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const response = await whatsappClient.get(src, { responseType: 'blob' });
        if (cancelled) return;
        const mimeType = response.headers['content-type'] || 'audio/ogg';
        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setAudioSrc(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAudio();
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onLoadedMetadata = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const filledBars = Math.round(progress * waveform.length);

  // Colors based on direction (outgoing = green bubble, incoming = white bubble)
  const playBtnBg = isOutgoing ? 'bg-[#25d366]' : 'bg-[#25d366]';
  const waveActive = isOutgoing ? '#075e54' : '#25d366';
  const waveInactive = isOutgoing ? 'rgba(0,0,0,0.25)' : '#c8c8c8';
  const timeColor = isOutgoing ? 'text-[#667781]' : 'text-[#8c8c8c]';

  return (
    <div className="flex items-center gap-2.5 py-1" style={{ minWidth: 220, maxWidth: 280 }}>
      {/* Hidden audio element */}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} preload="metadata" />
      )}

      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading || error || !audioSrc}
        className={`flex-shrink-0 w-10 h-10 rounded-full ${playBtnBg} flex items-center justify-center shadow-sm transition-opacity disabled:opacity-40`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 text-white fill-white" />
        ) : (
          <Play className="h-4 w-4 text-white fill-white ml-0.5" />
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex flex-col flex-1 gap-1 min-w-0">
        {/* Waveform bars */}
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer select-none"
          onClick={handleWaveformClick}
        >
          {waveform.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-100"
              style={{
                height: `${Math.round(height * 100)}%`,
                minHeight: 3,
                backgroundColor: i < filledBars ? waveActive : waveInactive,
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <div className={`flex items-center gap-1 ${timeColor}`} style={{ fontSize: 11 }}>
          <Mic className="h-3 w-3 opacity-60" />
          <span>{formatDuration(isPlaying || currentTime > 0 ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
