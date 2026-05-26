// src/components/bot-flow/drawers/NodeConfigDrawer.tsx
// Right-side drawer for editing a selected node

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBotFlowStore } from '@/store/botFlowStore';
import { NODE_COLORS, NODE_LABELS, NODE_ICONS } from '../nodes/nodeUtils';
import { SimpleMessageForm } from './forms/SimpleMessageForm';
import { InteractiveButtonForm } from './forms/InteractiveButtonForm';
import { InteractiveCtaForm } from './forms/InteractiveCtaForm';
import { InteractiveListForm } from './forms/InteractiveListForm';
import { CollectInputForm } from './forms/CollectInputForm';
import { TemplateMessageForm } from './forms/TemplateMessageForm';
import { MediaMessageForm } from './forms/MediaMessageForm';
import type { BotNode, MessageType } from '@/types/botFlowTypes';

export function NodeConfigDrawer({ flowUid }: { flowUid: string }) {
  const { isDrawerOpen, closeDrawer, selectedNodeId, nodes } = useBotFlowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = selectedNode?.data as unknown as BotNode | undefined;
  const messageType: MessageType = nodeData?.message_type ?? 'simple';
  const interactiveType = nodeData?.__data?.interaction_message?.interactive_type;

  const color = NODE_COLORS[messageType] ?? '#64748b';
  const label = NODE_LABELS[messageType] ?? 'Node';
  const Icon = NODE_ICONS[messageType];

  if (!selectedNode || !nodeData) return null;

  const getForm = () => {
    if (messageType === 'simple') {
      return <SimpleMessageForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
    }
    if (messageType === 'interactive') {
      if (interactiveType === 'cta_url') {
        return <InteractiveCtaForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
      }
      if (interactiveType === 'list') {
        return <InteractiveListForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
      }
      return <InteractiveButtonForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
    }
    if (messageType === 'media') {
      return <MediaMessageForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
    }
    if (messageType === 'collect_input') {
      return <CollectInputForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
    }
    if (messageType === 'template') {
      return <TemplateMessageForm key={selectedNodeId} node={nodeData} nodeId={selectedNodeId!} flowUid={flowUid} />;
    }
    return null;
  };

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="w-[360px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" style={{ color }} />}
            <SheetTitle className="text-sm font-semibold" style={{ color }}>
              {label}
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {getForm()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
