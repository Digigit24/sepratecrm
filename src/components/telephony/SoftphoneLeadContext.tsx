// src/components/telephony/SoftphoneLeadContext.tsx
// Shows the CRM lead behind the number the softphone is currently on a call
// with — either because the call was dialled from the CRM (leadId already
// known) or, for inbound/manually-dialled numbers, resolved via a debounced
// reverse phone lookup. Renders nothing when no lead matches.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLeadDrawerStore } from '@/store/leadDrawerStore';
import { crmService } from '@/services/crmService';
import type { LeadPhoneLookupResult } from '@/types/crmTypes';

interface SoftphoneLeadContextProps {
  leadId?: number;
  number?: string;
}

const Chip: React.FC<{ name: string; colorHex?: string | null; onOpen: () => void }> = ({ name, colorHex, onOpen }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
    <div className="min-w-0 flex items-center gap-1.5">
      {colorHex && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: colorHex }} />}
      <span className="text-xs font-medium truncate">{name}</span>
    </div>
    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 gap-1 shrink-0" onClick={onOpen}>
      Open Lead <ExternalLink className="h-3 w-3" />
    </Button>
  </div>
);

export const SoftphoneLeadContext: React.FC<SoftphoneLeadContextProps> = ({ leadId, number }) => {
  const openLead = useLeadDrawerStore((s) => s.openLead);
  const { useLead } = useCRM();
  const { data: knownLead } = useLead(leadId ?? null);

  const debouncedNumber = useDebouncedValue(leadId ? '' : (number || ''), 500);
  const [lookup, setLookup] = useState<LeadPhoneLookupResult | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (leadId || !debouncedNumber) {
      setLookup(null);
      return;
    }
    let cancelled = false;
    setLooking(true);
    crmService
      .lookupLeadByPhone(debouncedNumber)
      .then((res) => { if (!cancelled) setLookup(res); })
      .catch(() => { if (!cancelled) setLookup(null); })
      .finally(() => { if (!cancelled) setLooking(false); });
    return () => { cancelled = true; };
  }, [leadId, debouncedNumber]);

  if (leadId) {
    if (!knownLead) return null;
    const statusHex = typeof knownLead.status === 'object' ? knownLead.status?.color_hex : undefined;
    return <Chip name={knownLead.name} colorHex={statusHex} onOpen={() => openLead(knownLead.id)} />;
  }

  if (lookup) {
    return <Chip name={lookup.name} colorHex={lookup.status?.color_hex} onOpen={() => openLead(lookup.id)} />;
  }

  if (looking) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Looking up lead…
      </p>
    );
  }

  return null;
};
