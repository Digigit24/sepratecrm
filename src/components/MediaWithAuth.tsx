import React, { useState, useEffect, useRef } from 'react';
import { whatsappClient } from '@/lib/whatsappClient';

interface MediaWithAuthProps {
  src: string;
  alt: string;
  className?: string;
  previewSrc?: string;
  type: 'image' | 'video' | 'audio';
  lazy?: boolean;
}

const MediaWithAuth: React.FC<MediaWithAuthProps> = ({ src, alt, className, previewSrc, type, lazy = true }) => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(previewSrc || null);
  const [isLoading, setIsLoading] = useState(!previewSrc);
  const [error, setError] = useState<string | null>(null);
  const [isInView, setIsInView] = useState(!lazy);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the element comes into view
        threshold: 0.01,
      }
    );

    if (mediaRef.current) {
      observer.observe(mediaRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, isInView]);

  useEffect(() => {
    const fetchMedia = async () => {
      if (!src || previewSrc || !isInView) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await whatsappClient.get(src, {
          responseType: 'blob',
        });

        const mimeType = response.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setMediaSrc(url);
      } catch (err) {
        console.error('Failed to fetch media:', err);
        setError('Failed to load media');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();

    // Cleanup function
    return () => {
      if (mediaSrc && !previewSrc) {
        URL.revokeObjectURL(mediaSrc);
      }
    };
  }, [src, previewSrc, isInView]);

  if (isLoading || !isInView) {
    return (
      <div
        ref={mediaRef}
        className={`flex items-center justify-center bg-muted rounded-md ${className} min-h-[120px]`}
      >
        {isInView && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>}
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={mediaRef}
        className={`flex items-center justify-center bg-destructive/10 text-destructive text-xs rounded-md ${className}`}
      >
        {error}
      </div>
    );
  }

  if (!mediaSrc) {
    return <div ref={mediaRef} />;
  }

  if (type === 'image') {
    return (
      <div ref={mediaRef}>
        <img src={mediaSrc} alt={alt} className={className} loading="lazy" />
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div ref={mediaRef}>
        <video src={mediaSrc} controls className={className} preload="metadata" />
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div ref={mediaRef}>
        <audio src={mediaSrc} controls className={className} preload="metadata" />
      </div>
    );
  }

  return <div ref={mediaRef} />;
};

export default MediaWithAuth;
