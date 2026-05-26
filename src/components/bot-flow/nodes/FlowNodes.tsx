// src/components/bot-flow/nodes/FlowNodes.tsx
// All bot flow node types in one file

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Image, LayoutGrid, ExternalLink, List, FileText, Keyboard } from 'lucide-react';
import { useBotFlowStore } from '@/store/botFlowStore';
import type { BotNode, BotButton, ListSection } from '@/types/botFlowTypes';

// =========================================================================
// SHARED: Output Handle Row
// =========================================================================

function OutputHandle({ id, label, color }: { id: string; label: string; color: string }) {
  return (
    <div className="relative flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground truncate pr-4 max-w-[160px]">{label}</span>
      <Handle
        type="source"
        position={Position.Right}
        id={id}
        className="!relative !transform-none !w-3 !h-3 !rounded-full !border-2 !border-white"
        style={{ background: color, right: -12 }}
      />
    </div>
  );
}

// =========================================================================
// SHARED: Node Shell
// =========================================================================

interface NodeShellProps {
  id: string;
  selected?: boolean;
  color: string;
  Icon: React.ElementType;
  typeLabel: string;
  name: string;
  children?: React.ReactNode;
  hasDefaultOutput?: boolean;
  hasInput?: boolean;
}

function NodeShell({ id, selected, color, Icon, typeLabel, name, children, hasDefaultOutput = true, hasInput = true }: NodeShellProps) {
  const { selectNode, deleteNode } = useBotFlowStore();

  return (
    <div
      className="relative group rounded-xl border bg-card shadow-sm min-w-[220px] max-w-[280px] transition-shadow hover:shadow-md"
      style={{
        borderLeft: `4px solid ${color}`,
        outline: selected ? `2px solid ${color}` : 'none',
        outlineOffset: 2,
      }}
      onDoubleClick={() => selectNode(id)}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          className="!w-3 !h-3 !rounded-full !border-2 !border-white"
          style={{ background: color }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: `${color}15` }}>
        <Icon className="h-3 w-3 flex-shrink-0" style={{ color }} />
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color }}>
          {typeLabel}
        </span>
      </div>

      {/* Name */}
      <div className="px-3 py-1.5 border-b border-border/50">
        <p className="text-xs font-semibold truncate">{name}</p>
      </div>

      {/* Content */}
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {children}
      </div>

      {/* Default output */}
      {hasDefaultOutput && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          className="!w-3 !h-3 !rounded-full !border-2 !border-white"
          style={{ background: color }}
        />
      )}

      {/* Actions on hover */}
      <div className="absolute -top-7 right-0 hidden group-hover:flex items-center gap-0.5 bg-background border rounded-md shadow-sm px-1 py-0.5 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); selectNode(id); }}
          className="p-1 hover:bg-muted rounded text-xs"
          title="Edit node"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          className="p-1 hover:bg-muted rounded text-destructive text-xs"
          title="Delete node"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// =========================================================================
// SIMPLE MESSAGE NODE
// =========================================================================

export function SimpleMessageNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#22c55e';

  return (
    <NodeShell id={id} selected={selected} color={color} Icon={MessageSquare} typeLabel="Simple Message" name={nodeData.name}>
      <p className="line-clamp-2 text-[11px] leading-relaxed">
        {nodeData.reply_text || <span className="italic opacity-60">No message set</span>}
      </p>
    </NodeShell>
  );
}

// =========================================================================
// MEDIA MESSAGE NODE
// =========================================================================

export function MediaMessageNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#a855f7';
  const media = nodeData.__data?.media_message;

  return (
    <NodeShell id={id} selected={selected} color={color} Icon={Image} typeLabel="Media" name={nodeData.name}>
      <div className="space-y-1">
        {media?.header_type && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 uppercase">
            {media.header_type}
          </span>
        )}
        {media?.caption && <p className="line-clamp-1 text-[11px]">{media.caption}</p>}
        {!media?.caption && <p className="italic opacity-60 text-[11px]">No caption</p>}
      </div>
    </NodeShell>
  );
}

// =========================================================================
// INTERACTIVE BUTTON NODE
// =========================================================================

export function InteractiveButtonNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#f97316';
  const interaction = nodeData.__data?.interaction_message;
  const buttons = interaction?.buttons ? Object.entries(interaction.buttons) : [];

  return (
    <NodeShell
      id={id}
      selected={selected}
      color={color}
      Icon={LayoutGrid}
      typeLabel="Interactive Buttons"
      name={nodeData.name}
      hasDefaultOutput={false}
    >
      <div className="space-y-1">
        {interaction?.body_text && (
          <p className="line-clamp-2 text-[11px] leading-relaxed border-b border-border/50 pb-1.5 mb-1.5">
            {interaction.body_text}
          </p>
        )}
        {buttons.length > 0 ? (
          <div className="space-y-1">
            {buttons.map(([key, btn]) => (
              <OutputHandle key={key} id={`btn-${key}`} label={btn.title} color={color} />
            ))}
          </div>
        ) : (
          <p className="italic opacity-60 text-[11px]">No buttons configured</p>
        )}
      </div>
    </NodeShell>
  );
}

// =========================================================================
// INTERACTIVE CTA URL NODE
// =========================================================================

export function InteractiveCtaNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#06b6d4';
  const interaction = nodeData.__data?.interaction_message;

  return (
    <NodeShell id={id} selected={selected} color={color} Icon={ExternalLink} typeLabel="CTA URL" name={nodeData.name}>
      <div className="space-y-1">
        {interaction?.body_text && (
          <p className="line-clamp-2 text-[11px] leading-relaxed">{interaction.body_text}</p>
        )}
        {interaction?.cta_url && (
          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 truncate">
            🔗 {interaction.cta_url.display_text}
          </p>
        )}
      </div>
    </NodeShell>
  );
}

// =========================================================================
// INTERACTIVE LIST NODE
// =========================================================================

export function InteractiveListNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#eab308';
  const interaction = nodeData.__data?.interaction_message;
  const sections: ListSection[] = interaction?.list_data?.sections || [];
  const allRows = sections.flatMap((s, si) =>
    (s.rows || []).map((r, ri) => ({ ...r, sectionIndex: si, rowIndex: ri }))
  );

  return (
    <NodeShell
      id={id}
      selected={selected}
      color={color}
      Icon={List}
      typeLabel="List Message"
      name={nodeData.name}
      hasDefaultOutput={false}
    >
      <div className="space-y-1">
        {interaction?.body_text && (
          <p className="line-clamp-2 text-[11px] leading-relaxed border-b border-border/50 pb-1.5 mb-1.5">
            {interaction.body_text}
          </p>
        )}
        {allRows.length > 0 ? (
          <div className="space-y-1">
            {allRows.map((row) => (
              <OutputHandle
                key={`${row.sectionIndex}-${row.rowIndex}`}
                id={`list-s${row.sectionIndex}-r${row.rowIndex}`}
                label={row.title}
                color={color}
              />
            ))}
          </div>
        ) : (
          <p className="italic opacity-60 text-[11px]">No list rows configured</p>
        )}
      </div>
    </NodeShell>
  );
}

// =========================================================================
// TEMPLATE NODE
// =========================================================================

export function TemplateNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#ec4899';
  const template = nodeData.__data?.template_message;

  return (
    <NodeShell id={id} selected={selected} color={color} Icon={FileText} typeLabel="Template" name={nodeData.name}>
      <p className="text-[11px]">
        {template?.template_uid ? (
          <span className="font-mono">{template.template_uid}</span>
        ) : (
          <span className="italic opacity-60">No template selected</span>
        )}
      </p>
    </NodeShell>
  );
}

// =========================================================================
// COLLECT INPUT NODE
// =========================================================================

export function CollectInputNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as BotNode;
  const color = '#ef4444';
  const input = nodeData.__data?.collect_input;

  return (
    <NodeShell id={id} selected={selected} color={color} Icon={Keyboard} typeLabel="Collect Input" name={nodeData.name} hasDefaultOutput={false}>
      <div className="space-y-1.5">
        {input?.question && (
          <p className="line-clamp-2 text-[11px] leading-relaxed border-b border-border/50 pb-1.5">
            {input.question}
          </p>
        )}
        {input?.variable_name && (
          <p className="text-[10px] font-mono text-red-600 dark:text-red-400">
            → {'{' + input.variable_name + '}'}
          </p>
        )}
        <OutputHandle id="collect-output" label="Continue" color={color} />
      </div>
    </NodeShell>
  );
}
