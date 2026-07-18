// src/lib/whatsapp/renderTemplate.ts
//
// SHARED WhatsApp template renderer — single source of truth for turning a
// template message payload into displayable content (body with resolved
// variables, header text/media, footer, buttons).
//
// Extracted from the already-correct ChatWindow.tsx (Inbox) helpers so BOTH the
// Inbox (ChatWindow) and the CRM lead drawer (LeadWhatsAppDrawer) render
// templates identically. Pure functions — no React, no side effects.
//
// Input shape matches the rich lead-chat/inbox payload:
//   template_proforma:        { name, components: [{type:'BODY'|'HEADER'|'FOOTER'|'BUTTONS', ...}] }
//   template_components:      same component array (fallback source)
//   template_component_values: [{ type:'body', parameters: { '{{1}}': {text} | value, ... } }, ...]
//   metadata:                 arbitrary; may hold template_name

export interface TemplateSource {
  template_proforma?: { name?: string; components?: any[] } | null;
  template_components?: any[] | null;
  template_component_values?: any[] | null;
  metadata?: Record<string, any> | null;
  /** Plain text fallback (non-template or already-flattened). */
  text?: string | null;
}

export type TemplateMediaType = 'image' | 'video' | 'document' | 'audio';

export interface TemplateHeaderMedia {
  type: TemplateMediaType;
  url: string;
}

/** True when the payload represents a WhatsApp template message. */
export function isTemplateMessage(src: TemplateSource): boolean {
  return !!(
    src.template_proforma ||
    src.template_components ||
    src.metadata?.template_name
  );
}

/** Template display name, if any. */
export function getTemplateName(src: TemplateSource): string | null {
  return src.template_proforma?.name || src.metadata?.template_name || null;
}

function components(src: TemplateSource): any[] {
  return (src.template_proforma?.components || src.template_components || []) as any[];
}

/**
 * Extract resolved body parameter values keyed by their number:
 *   [{ type:'body', parameters: { '{{1}}': {text:'Ada'} } }] -> { '1': 'Ada' }
 * Also tolerates array-style `parameters: [{text}]` (positional).
 */
export function getTemplateParameterValues(componentValues: any[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(componentValues)) return out;

  const body = componentValues.find(
    (c) => String(c?.type).toLowerCase() === 'body',
  );
  const params = body?.parameters;
  if (!params) return out;

  if (Array.isArray(params)) {
    params.forEach((p: any, i: number) => {
      out[String(i + 1)] = p?.text ?? (typeof p === 'string' ? p : '') ?? '';
    });
  } else if (typeof params === 'object') {
    Object.entries(params).forEach(([key, value]: [string, any]) => {
      const m = key.match(/\{\{(\d+)\}\}/);
      const idx = m ? m[1] : key;
      out[idx] = value?.text ?? (typeof value === 'string' ? value : '') ?? '';
    });
  }
  return out;
}

/** Substitute {{n}} placeholders in a body string from resolved values. */
function substitute(text: string, values: Record<string, string>): string {
  let out = text;
  Object.entries(values).forEach(([key, value]) => {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  return out;
}

/** Rendered BODY text with {{n}} replaced by resolved values (best-effort). */
export function renderTemplateBody(src: TemplateSource): string {
  const comps = components(src);
  const body = comps.find((c: any) => String(c?.type).toUpperCase() === 'BODY');
  if (body?.text) {
    const values = getTemplateParameterValues(src.template_component_values);
    // Body components may also carry their own resolved `parameters`.
    if (Object.keys(values).length === 0 && body.parameters) {
      const inline = getTemplateParameterValues([{ type: 'body', parameters: body.parameters }]);
      return substitute(body.text, inline);
    }
    return substitute(body.text, values);
  }
  if (src.text) return src.text;
  const name = getTemplateName(src);
  return name ? `[Template: ${name}]` : '[Template Message]';
}

/** Header TEXT (format=TEXT), or null. */
export function getTemplateHeaderText(src: TemplateSource): string | null {
  const header = components(src).find(
    (c: any) => String(c?.type).toUpperCase() === 'HEADER' && String(c?.format).toUpperCase() === 'TEXT',
  );
  return header?.text || null;
}

/** Header MEDIA (image/video/document), resolving the media URL from common shapes. */
export function getTemplateHeaderMedia(src: TemplateSource): TemplateHeaderMedia | null {
  const header = components(src).find(
    (c: any) => String(c?.type).toUpperCase() === 'HEADER',
  );
  if (!header) return null;
  const format = String(header.format || '').toUpperCase();
  const type = format === 'IMAGE' ? 'image' : format === 'VIDEO' ? 'video' : format === 'DOCUMENT' ? 'document' : null;
  if (!type) return null;

  // Resolved param shapes: { image:{link} } / { video:{link} } / { document:{link} }
  const p = Array.isArray(header.parameters) ? header.parameters[0] : header.parameters;
  const url =
    p?.[type]?.link ||
    p?.link ||
    p?.url ||
    header.url ||
    header.media_url ||
    header.example?.header_handle?.[0] ||
    header.example?.header_url?.[0] ||
    null;

  return url ? { type, url } : null;
}

/** Footer text, or null. */
export function getTemplateFooter(src: TemplateSource): string | null {
  const footer = components(src).find((c: any) => String(c?.type).toUpperCase() === 'FOOTER');
  return footer?.text || null;
}

/** Buttons ([{type,text}]), or null. */
export function getTemplateButtons(src: TemplateSource): Array<{ type: string; text: string }> | null {
  const btns = components(src).find((c: any) => String(c?.type).toUpperCase() === 'BUTTONS');
  if (btns?.buttons?.length) return btns.buttons;
  return null;
}
