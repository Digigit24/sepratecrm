// src/store/leadDrawerStore.ts
// Global "open the Lead Details drawer from anywhere" store. Any page that
// references a lead (Call Logs, Campaigns, Softphone, ...) can call
// useLeadDrawerStore.getState().openLead(id) instead of re-implementing its
// own drawerOpen/selectedLeadId local state or doing a full navigate().
import { create } from 'zustand';

export type LeadDrawerMode = 'view' | 'edit';

interface LeadDrawerStore {
  leadId: number | null;
  mode: LeadDrawerMode;
  isOpen: boolean;
  openLead: (leadId: number, mode?: LeadDrawerMode) => void;
  close: () => void;
  setMode: (mode: LeadDrawerMode) => void;
}

export const useLeadDrawerStore = create<LeadDrawerStore>((set) => ({
  leadId: null,
  mode: 'view',
  isOpen: false,
  openLead: (leadId, mode = 'view') => set({ leadId, mode, isOpen: true }),
  close: () => set({ isOpen: false }),
  setMode: (mode) => set({ mode }),
}));
