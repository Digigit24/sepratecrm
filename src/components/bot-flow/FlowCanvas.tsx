// src/components/bot-flow/FlowCanvas.tsx
// Main React Flow canvas for the Bot Flow Builder

import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useBotFlowStore } from '@/store/botFlowStore';
import { StartNode } from './nodes/StartNode';
import {
  SimpleMessageNode,
  MediaMessageNode,
  InteractiveButtonNode,
  InteractiveCtaNode,
  InteractiveListNode,
  TemplateNode,
  CollectInputNode,
} from './nodes/FlowNodes';
import { NodePalette } from './panels/NodePalette';
import { NodeConfigDrawer } from './drawers/NodeConfigDrawer';
import { NODE_COLORS } from './nodes/nodeUtils';
import type { BotNode, MessageType } from '@/types/botFlowTypes';
import { nanoid } from 'nanoid';

const nodeTypes = {
  start: StartNode,
  simple: SimpleMessageNode,
  media: MediaMessageNode,
  interactive: InteractiveButtonNode,
  interactive_cta: InteractiveCtaNode,
  interactive_list: InteractiveListNode,
  template: TemplateNode,
  collect_input: CollectInputNode,
};

// Map drag-palette type to React Flow node type
function paletteTypeToNodeType(type: string): string {
  if (type === 'interactive_cta') return 'interactive_cta';
  if (type === 'interactive_list') return 'interactive_list';
  return type;
}

// Map drag-palette type to BotNode message_type
function paletteTypeToMessageType(type: string): MessageType {
  if (type === 'interactive_cta' || type === 'interactive_list' || type === 'interactive') return 'interactive';
  return type as MessageType;
}

// Map drag-palette type to interactive_type
function paletteTypeToInteractiveType(type: string): string | undefined {
  if (type === 'interactive') return 'button';
  if (type === 'interactive_cta') return 'cta_url';
  if (type === 'interactive_list') return 'list';
  return undefined;
}

interface Props {
  flowUid: string;
}

export function FlowCanvas({ flowUid }: Props) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    selectNode,
    addNode,
    pushHistory,
    flow,
  } = useBotFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
            style: { strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges, pushHistory]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'start') {
        selectNode(node.id);
      }
    },
    [selectNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const x = event.clientX - bounds.left - 110;
      const y = event.clientY - bounds.top - 50;

      const tempId = `temp-${nanoid(8)}`;
      const messageType = paletteTypeToMessageType(type);
      const interactiveType = paletteTypeToInteractiveType(type);
      const nodeType = paletteTypeToNodeType(type);

      const newNode: Node = {
        id: tempId,
        type: nodeType,
        position: { x, y },
        data: {
          _uid: tempId,
          name: 'New Node',
          reply_text: '',
          message_type: messageType,
          status: 2,
          __data: interactiveType
            ? { interaction_message: { interactive_type: interactiveType, body_text: '', header_type: 'none', buttons: {}, footer_text: '' } }
            : {},
        } as unknown as BotNode,
      };

      pushHistory();
      addNode(newNode);
      selectNode(tempId);
    },
    [addNode, selectNode, pushHistory]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Save handled by parent
        document.dispatchEvent(new CustomEvent('flow-save'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const edgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: { strokeWidth: 2, stroke: '#64748b' },
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <NodePalette />

      <div ref={reactFlowWrapper} className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={edgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode="Shift"
          className="bg-muted/20"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground) / 0.3)" />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-right"
            style={{ bottom: 48 }}
            nodeColor={(node) => {
              const msgType = (node.data as any)?.message_type as MessageType | 'start';
              return NODE_COLORS[msgType] ?? '#64748b';
            }}
            maskColor="hsl(var(--background) / 0.7)"
          />
        </ReactFlow>
      </div>

      <NodeConfigDrawer flowUid={flowUid} />
    </div>
  );
}
