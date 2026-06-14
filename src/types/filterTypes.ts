// src/types/filterTypes.ts
import type { LeadFieldConfiguration } from './crmTypes';

export type FilterPlacement = 'tabs' | 'toolbar' | 'drawer' | 'hidden';

export type FilterFieldType =
  | 'multi_status'
  | 'multi_priority'
  | 'lead_score_range'
  | 'user_select'
  | 'group_select'
  | 'text_contains'
  | 'date_range'
  | 'boolean_toggle'
  | 'number_range'
  | 'single_select'
  | 'multi_select';

export interface FilterFieldDef {
  key: string;
  label: string;
  filterType: FilterFieldType;
  isCustom: boolean;
  fieldConfig?: LeadFieldConfiguration;
  options?: string[];
}

export interface FilterFieldLayout {
  key: string;
  placement: FilterPlacement;
}

export interface CrmLeadsFilterConfig {
  fields: FilterFieldLayout[];
}

// Active filter values - flexible map
export type ActiveFilters = Record<string, any>;

// Default config used when no preference is saved
export const DEFAULT_FILTER_CONFIG: CrmLeadsFilterConfig = {
  fields: [
    { key: 'status', placement: 'tabs' },
    { key: 'priority', placement: 'toolbar' },
    { key: 'lead_score', placement: 'toolbar' },
    { key: 'owner_user_id', placement: 'toolbar' },
    { key: 'name', placement: 'drawer' },
    { key: 'phone', placement: 'drawer' },
    { key: 'email', placement: 'drawer' },
    { key: 'company', placement: 'drawer' },
    { key: 'source', placement: 'drawer' },
    { key: 'city', placement: 'drawer' },
    { key: 'state', placement: 'drawer' },
    { key: 'country', placement: 'drawer' },
    { key: 'value_amount', placement: 'drawer' },
    { key: 'created_at', placement: 'drawer' },
    { key: 'updated_at', placement: 'hidden' },
    { key: 'next_follow_up_at', placement: 'drawer' },
    { key: 'hide_duplicates', placement: 'drawer' },
    // NOTE: 'groups' is intentionally omitted — it's always shown as a
    // permanent dropdown in the toolbar, not managed by the filter config.
  ],
};

// Standard filter definitions (hardcoded for built-in Lead fields)
export const STANDARD_FILTER_DEFS: FilterFieldDef[] = [
  { key: 'status', label: 'Status', filterType: 'multi_status', isCustom: false },
  { key: 'priority', label: 'Priority', filterType: 'multi_priority', isCustom: false },
  { key: 'lead_score', label: 'Lead Score', filterType: 'lead_score_range', isCustom: false },
  { key: 'owner_user_id', label: 'Owner', filterType: 'user_select', isCustom: false },
  { key: 'name', label: 'Name', filterType: 'text_contains', isCustom: false },
  { key: 'phone', label: 'Phone', filterType: 'text_contains', isCustom: false },
  { key: 'email', label: 'Email', filterType: 'text_contains', isCustom: false },
  { key: 'company', label: 'Company', filterType: 'text_contains', isCustom: false },
  { key: 'source', label: 'Source', filterType: 'text_contains', isCustom: false },
  { key: 'city', label: 'City', filterType: 'text_contains', isCustom: false },
  { key: 'state', label: 'State', filterType: 'text_contains', isCustom: false },
  { key: 'country', label: 'Country', filterType: 'text_contains', isCustom: false },
  { key: 'value_amount', label: 'Deal Value', filterType: 'number_range', isCustom: false },
  { key: 'created_at', label: 'Created Date', filterType: 'date_range', isCustom: false },
  { key: 'updated_at', label: 'Updated Date', filterType: 'date_range', isCustom: false },
  { key: 'next_follow_up_at', label: 'Next Follow-Up', filterType: 'date_range', isCustom: false },
  { key: 'hide_duplicates', label: 'Hide Duplicates', filterType: 'boolean_toggle', isCustom: false },
  // 'groups' is NOT in STANDARD_FILTER_DEFS — handled as a permanent toolbar
  // dropdown in CRMLeads, not through the configurable filter layout.
];
