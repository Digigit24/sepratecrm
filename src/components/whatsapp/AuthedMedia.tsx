// src/components/whatsapp/AuthedMedia.tsx
//
// Media primitives for the chat transcript. Every byte is fetched through the
// AUTHENTICATED DigiCRM proxy (GET /api/whatsapp/media/<id>/) as a blob and
// handed to the DOM as an object URL.
//
// We never put a media URL in a `src` attribute directly. Laravel's public media
// route (`/api/{vendorUid}/media/{filename}`) ignores the vendor uid, does no
// path containment, and will serve any file on disk — including `.env`, whose
// APP_KEY decrypts every tenant's Meta credentials. Linking it from the browser
// would also leak the media to anyone with the URL. The proxy is the only door.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Download, Play, Pause, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthedMedia } from '@/hooks/whatsapp/useAuthedMedia';

// ─────────────────────────────────────────────────────────────────────────────
// Shared shells
// ─────────────────────────────────────────────────────────────────────────────

const MediaSkeleton: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <div
    className={cn(
      'flex min-h-[120px] min-w-[160px] items-center justify-center rounded-md bg-black/5',
      className,
    )}
  >
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
    <span className="sr-only">{label ?? 'Loading media'}</span>
  </div>
);

const MediaError: React.FC<{ className?: string; label: string }> = ({ className, label }) => (
  <div
    className={cn(
      'flex min-h-[64px] items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive',
      className,
    )}
  >
    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Image (with tap-to-zoom lightbox) and sticker
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthedImageProps {
  mediaId: string | null | undefined;
  alt: string;
  className?: string;
  /** Stickers render transparent, unbounded and are not zoomable. */
  sticker?: boolean;
}

export const AuthedImage: React.FC<AuthedImageProps> = ({ mediaId, alt, className, sticker }) => {
  const { url, loading, error, ref } = useAuthedMedia(mediaId);
  const [zoomed, setZoomed] = useState(false);

  // Escape closes the lightbox; without this the overlay traps the user.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  if (loading) return <MediaSkeleton className={className} />;
  if (error || !url) {
    return <MediaError className={className} label={sticker ? 'Sticker unavailable' : 'Image unavailable'} />;
  }

  if (sticker) {
    return (
      <div ref={ref}>
        <img
          src={url}
          alt={alt}
          className={cn('h-auto max-w-[128px] bg-transparent object-contain', className)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block cursor-zoom-in rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open image: ${alt}`}
      >
        <img
          src={url}
          alt={alt}
          className={cn('h-auto w-full max-w-[260px] rounded-md object-cover', className)}
          loading="lazy"
        />
      </button>

      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close image"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={url}
            alt={alt}
            className="max-h-full max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────────────────────────────────────

export const AuthedVideo: React.FC<{ mediaId: string | null | undefined; className?: string }> = ({
  mediaId,
  className,
}) => {
  const { url, loading, error, ref } = useAuthedMedia(mediaId);

  if (loading) return <MediaSkeleton className={className} label="Loading video" />;
  if (error || !url) return <MediaError className={className} label="Video unavailable" />;

  return (
    <div ref={ref}>
      <video
        src={url}
        controls
        preload="metadata"
        className={cn('w-full max-w-[280px] rounded-md', className)}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio / voice note
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Deterministic pseudo-waveform — a real one needs the decoded PCM. */
const WAVEFORM_BARS = 28;
function waveformFor(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    // 0.25–1.0 so no bar is invisible.
    return 0.25 + ((h >>> 16) % 76) / 100;
  });
}

export const AuthedAudio: React.FC<{
  mediaId: string | null | undefined;
  className?: string;
  outgoing?: boolean;
}> = ({ mediaId, className, outgoing }) => {
  const { url, loading, error, ref } = useAuthedMedia(mediaId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const bars = React.useMemo(() => waveformFor(mediaId ?? 'audio'), [mediaId]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  if (loading) return <MediaSkeleton className={cn('min-h-[56px]', className)} label="Loading audio" />;
  if (error || !url) return <MediaError className={className} label="Audio unavailable" />;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <div
      ref={ref}
      className={cn('flex min-w-[220px] items-center gap-3 py-1', className)}
      data-testid="audio-player"
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors',
          outgoing ? 'bg-[#25d366] hover:bg-[#1eb356]' : 'bg-[#54656f] hover:bg-[#3f4c53]',
        )}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex h-6 items-center gap-[2px]" aria-hidden="true">
          {bars.map((height, i) => {
            const played = i / bars.length <= progress;
            return (
              <span
                key={i}
                className={cn(
                  'w-[3px] rounded-full transition-colors',
                  played ? 'bg-[#25d366]' : 'bg-black/20',
                )}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(playing || position > 0 ? position : duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        className="hidden"
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export const AuthedDocument: React.FC<{
  mediaId: string | null | undefined;
  filename: string;
  size?: number | null;
  mime?: string | null;
  className?: string;
}> = ({ mediaId, filename, size, mime, className }) => {
  // Documents are fetched on demand: pre-downloading every PDF in a transcript
  // would be gratuitous. `enabled` flips when the user asks for it.
  const [requested, setRequested] = useState(false);
  const { url, loading, error } = useAuthedMedia(mediaId, { lazy: false, enabled: requested });

  const extension = filename.includes('.') ? filename.split('.').pop()!.toUpperCase() : null;
  const meta = [extension, formatBytes(size)].filter(Boolean).join(' · ');

  // Once the blob exists, click through to the real download.
  const anchorRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (url && requested && anchorRef.current) {
      anchorRef.current.click();
      // Leave `requested` true so the link stays live for a second click.
    }
  }, [url, requested]);

  return (
    <div
      className={cn(
        'flex min-w-[220px] max-w-[280px] items-center gap-3 rounded-md bg-black/5 px-3 py-2',
        className,
      )}
      data-testid="document-attachment"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/80">
        <FileText className="h-5 w-5 text-[#54656f]" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0b141a]" title={filename}>
          {filename}
        </p>
        {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => setRequested(true)}
        disabled={loading || !mediaId}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-50"
        aria-label={`Download ${filename}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4 text-[#54656f]" aria-hidden="true" />
        )}
      </button>

      {url ? (
        <a ref={anchorRef} href={url} download={filename} className="hidden" aria-hidden="true">
          {filename}
        </a>
      ) : null}
      {mime ? <span className="sr-only">{mime}</span> : null}
    </div>
  );
};
