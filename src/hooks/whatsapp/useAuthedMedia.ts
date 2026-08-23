// src/hooks/whatsapp/useAuthedMedia.ts
//
// Fetch one WhatsApp media item through the AUTHENTICATED DigiCRM proxy
// (GET /api/whatsapp/media/<id>/) and expose it as an object URL.
//
// Lives apart from the media components so those files export only components:
// mixing a hook and components in one module breaks React Fast Refresh for
// every importer.
//
// We never put a media URL straight into a `src` attribute. Laravel's public
// media route ignores its vendor uid, does no path containment, and will serve
// any file on disk — including `.env`, whose APP_KEY decrypts every tenant's
// Meta credentials. The proxy is the only door.

import { useEffect, useRef, useState } from 'react';
import { whatsappChatService } from '@/services/whatsappChatService';

interface MediaState {
  url: string | null;
  mime: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch one media item as an object URL, lazily (only once it scrolls near the
 * viewport) and revoking on unmount so a long transcript does not leak blobs.
 */
export function useAuthedMedia(
  mediaId: string | null | undefined,
  options: { lazy?: boolean; enabled?: boolean } = {},
): MediaState & { ref: React.RefObject<HTMLDivElement> } {
  const { lazy = true, enabled = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  const [state, setState] = useState<MediaState>({
    url: null,
    mime: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!lazy || inView) return;
    const node = ref.current;
    if (!node) return;
    // jsdom and older browsers have no IntersectionObserver — load eagerly
    // rather than never showing the media at all.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, inView]);

  useEffect(() => {
    if (!enabled || !mediaId || !inView) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    setState({ url: null, mime: null, loading: true, error: null });

    whatsappChatService
      .fetchMediaObjectUrl(mediaId)
      .then(({ url, mimeType }) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState({ url, mime: mimeType, loading: false, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ url: null, mime: null, loading: false, error: 'Media unavailable' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, inView, enabled]);

  return { ...state, ref };
}
