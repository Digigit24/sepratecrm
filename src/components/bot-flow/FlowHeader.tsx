// src/components/bot-flow/FlowHeader.tsx
// Top bar for the Bot Flow Builder

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useBotFlowStore } from '@/store/botFlowStore';
import { botFlowService } from '@/services/whatsapp/botFlowService';
import { toast } from 'sonner';
import type { BotFlow } from '@/types/botFlowTypes';

interface Props {
  onSave: () => Promise<void>;
}

export function FlowHeader({ onSave }: Props) {
  const navigate = useNavigate();
  const { flow, isDirty, isSaving, setFlow } = useBotFlowStore();
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  if (!flow) return null;

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    try {
      await botFlowService.toggleStatus(flow._uid, !flow.is_active);
      setFlow({ ...flow, is_active: !flow.is_active, status: flow.is_active ? 2 : 1 } as BotFlow);
      toast.success(flow.is_active ? 'Flow deactivated' : 'Flow activated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background/95 backdrop-blur z-10">
      {/* Left: Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/whatsapp/bot-flows')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-sm font-semibold">{flow.title}</h1>
          <p className="text-[10px] text-muted-foreground font-mono">{flow.start_trigger}</p>
        </div>
        {isDirty && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Right: Status + Save */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {flow.is_active ? (
            <Zap className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <ZapOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Switch
            checked={flow.is_active}
            onCheckedChange={handleToggleStatus}
            disabled={isTogglingStatus}
          />
          <Label className="text-xs cursor-pointer">
            {flow.is_active ? 'Active' : 'Inactive'}
          </Label>
        </div>

        <Button size="sm" onClick={onSave} disabled={isSaving || !isDirty}>
          {isSaving ? (
            <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
