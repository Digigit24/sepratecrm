// src/lib/whatsapp/templateVariables.ts
//
// CRM variable support for WhatsApp templates (v1).
//
// Design: WhatsApp templates only allow POSITIONAL params ({{1}}, {{2}}…). To
// let users insert *named* CRM fields, we map each positional param number to a
// CRM lead field key and persist that mapping locally (keyed by template name).
// At SEND time from a lead, we auto-substitute {{n}} with the lead's value.
//
// v1 stores the mapping in localStorage (no backend schema change). A later
// version can persist it in the template's metadata/example on the backend.

/** paramNumber ("1","2"…) → CRM lead field key ("name","email"…). */
export type VariableMapping = Record<string, string>;

/** CRM lead fields offered in the "insert variable" menu. */
export const CRM_VARIABLE_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Full name' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Job title' },
  { key: 'city', label: 'City' },
  { key: 'source', label: 'Source' },
];

export function crmFieldLabel(key: string): string {
  return CRM_VARIABLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

const storageKey = (templateName: string) => `celiyo_wa_varmap:${templateName}`;

export function saveVariableMapping(templateName: string, mapping: VariableMapping): void {
  if (!templateName) return;
  try {
    if (Object.keys(mapping).length) {
      localStorage.setItem(storageKey(templateName), JSON.stringify(mapping));
    } else {
      localStorage.removeItem(storageKey(templateName));
    }
  } catch {
    /* ignore storage errors */
  }
}

export function loadVariableMapping(templateName: string): VariableMapping {
  if (!templateName) return {};
  try {
    const raw = localStorage.getItem(storageKey(templateName));
    return raw ? (JSON.parse(raw) as VariableMapping) : {};
  } catch {
    return {};
  }
}

/** Resolve a lead's value for a CRM field key (with a couple of derived fields). */
export function leadFieldValue(lead: any, fieldKey: string): string {
  if (!lead) return '';
  const direct = lead[fieldKey];
  if (direct != null && direct !== '') return String(direct);
  if (fieldKey === 'name' && (lead.first_name || lead.last_name)) {
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  }
  if ((fieldKey === 'first_name' || fieldKey === 'last_name') && lead.name) {
    const parts = String(lead.name).trim().split(/\s+/);
    return fieldKey === 'first_name' ? parts[0] || '' : parts.slice(1).join(' ');
  }
  return '';
}

/**
 * Build the {{n}} → resolved-value map for a lead, given a saved mapping.
 * Keys are in "{{n}}" form to match the send dialog's templateVariables state.
 */
export function resolveLeadVariables(templateName: string, lead: any): Record<string, string> {
  const mapping = loadVariableMapping(templateName);
  const out: Record<string, string> = {};
  for (const [num, fieldKey] of Object.entries(mapping)) {
    const value = leadFieldValue(lead, fieldKey);
    if (value) out[`{{${num}}}`] = value;
  }
  return out;
}
