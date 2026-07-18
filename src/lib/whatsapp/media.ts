// src/lib/whatsapp/media.ts
//
// SHARED authenticated WhatsApp media fetch — routes through the digicrm media
// proxy (crmClient → GET /api/whatsapp/media/<path:filename>/, JWT + tenant)
// instead of the old direct-Laravel whatsappClient. Behavior is identical:
// authed blob fetch → object URL (+ content-type); callers revoke the URL.
//
// The digicrm proxy's `filename` is the media identifier that Laravel serves at
// `/{vendorUid}/media/<filename>`. Incoming `src` may be a full URL
// (…/messages/media/<id>) or a bare id — we extract the media filename/path.

import { crmClient } from '@/lib/client';

/** Extract the media filename/path segment from an incoming media src. */
export function toMediaFilename(src: string): string {
  if (!src) return '';
  let path = src;
  try {
    // Absolute URL → take the pathname; relative strings fall through.
    path = new URL(src, 'http://_').pathname;
  } catch {
    /* relative string — use as-is */
  }
  path = path.split('?')[0].split('#')[0];
  // Prefer everything after the last "/media/"; else the raw path/id.
  const marker = '/media/';
  const idx = path.lastIndexOf(marker);
  const tail = idx !== -1 ? path.slice(idx + marker.length) : path;
  return tail.replace(/^\/+/, '').replace(/\/+$/, '');
}

export interface MediaObject {
  url: string;
  mimeType: string;
}

/**
 * Fetch WhatsApp media (authenticated, via the digicrm proxy) and return an
 * object URL + resolved content-type. Caller is responsible for revoking `url`.
 */
export async function fetchWhatsappMediaObjectUrl(
  src: string,
  fallbackMime = 'application/octet-stream',
): Promise<MediaObject> {
  const filename = toMediaFilename(src);
  const response = await crmClient.get(`/whatsapp/media/${filename}/`, {
    responseType: 'blob',
  });
  const mimeType = (response.headers as any)['content-type'] || fallbackMime;
  const blob = new Blob([response.data as BlobPart], { type: mimeType });
  return { url: URL.createObjectURL(blob), mimeType };
}
