// src/components/GlobalLeadDrawer.tsx
// Single app-wide instance of LeadsFormDrawer, driven by useLeadDrawerStore.
// Mounted once in App.tsx so any page can open a lead's details without
// owning its own drawer state or navigating away from what's on screen.
import { useLeadDrawerStore } from '@/store/leadDrawerStore';
import { LeadsFormDrawer } from '@/components/LeadsFormDrawer';

export function GlobalLeadDrawer() {
  const { leadId, mode, isOpen, close, setMode } = useLeadDrawerStore();

  if (leadId === null) return null;

  return (
    <LeadsFormDrawer
      open={isOpen}
      onOpenChange={(open) => { if (!open) close(); }}
      leadId={leadId}
      mode={mode}
      onModeChange={(m) => { if (m !== 'create') setMode(m); }}
    />
  );
}
