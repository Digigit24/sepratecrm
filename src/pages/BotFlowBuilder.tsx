// src/pages/BotFlowBuilder.tsx
// Bot Flow Builder page — full-screen canvas editor

import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { toast } from 'sonner';

import { useBotFlowStore } from '@/store/botFlowStore';
import { botFlowService } from '@/services/whatsapp/botFlowService';
import { FlowHeader } from '@/components/bot-flow/FlowHeader';
import { FlowCanvas } from '@/components/bot-flow/FlowCanvas';
import type { BotNode, BotFlow, FlowBuilderData, FlowLink } from '@/types/botFlowTypes';
import type { Node, Edge } from '@xyflow/react';

// =========================================================================
// DATA TRANSFORM: Backend → React Flow
// =========================================================================

function botNodesToReactFlow(
  flow: BotFlow,
  nodes: BotNode[]
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const builderData = flow.flow_builder_data;
  const operators = builderData?.operators ?? {};
  const links = builderData?.links ?? {};

  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // Start node
  const startPos = operators['start'] ?? { top: 100, left: 80 };
  rfNodes.push({
    id: 'start',
    type: 'start',
    position: { x: startPos.left, y: startPos.top },
    data: { start_trigger: flow.start_trigger },
  });

  // Bot reply nodes
  nodes.forEach((node) => {
    const pos = operators[node._uid] ?? { top: 250, left: 300 };
    const interactiveType = node.__data?.interaction_message?.interactive_type;

    let rfType = node.message_type as string;
    if (node.message_type === 'interactive') {
      if (interactiveType === 'cta_url') rfType = 'interactive_cta';
      else if (interactiveType === 'list') rfType = 'interactive_list';
      else rfType = 'interactive';
    }

    rfNodes.push({
      id: node._uid,
      type: rfType,
      position: { x: pos.left, y: pos.top },
      data: node as unknown as Record<string, unknown>,
    });
  });

  // Edges from links
  Object.entries(links).forEach(([linkId, link]: [string, FlowLink]) => {
    const sourceHandle =
      link.fromConnector === 0 || link.fromConnector === '0'
        ? 'output'
        : typeof link.fromConnector === 'number'
        ? `btn-${link.fromConnector}`
        : String(link.fromConnector).startsWith('sections')
        ? `list-${String(link.fromConnector).replace('sections___', 's').replace('___rows___', '-r').replace('___title', '')}`
        : String(link.fromConnector) === 'collect_input_output'
        ? 'collect-output'
        : `btn-${link.fromConnector}`;

    rfEdges.push({
      id: linkId,
      source: String(link.fromOperator),
      target: String(link.toOperator),
      sourceHandle,
      targetHandle: 'input',
      type: 'smoothstep',
      animated: true,
      style: { strokeWidth: 2, stroke: '#64748b' },
    });
  });

  return { rfNodes, rfEdges };
}

// =========================================================================
// DATA TRANSFORM: React Flow → Backend
// =========================================================================

function reactFlowToBuilderData(
  rfNodes: Node[],
  rfEdges: Edge[]
): FlowBuilderData {
  const operators: Record<string, any> = {};
  const links: Record<string, FlowLink> = {};

  rfNodes.forEach((node) => {
    if (node.id === 'start') {
      operators['start'] = { top: node.position.y, left: node.position.x };
      return;
    }

    const nodeData = node.data as unknown as BotNode;
    const outputs: Record<string, { label: string }> = {};

    if (nodeData.message_type === 'interactive') {
      const interaction = nodeData.__data?.interaction_message;
      if (interaction?.interactive_type === 'button' && interaction.buttons) {
        Object.entries(interaction.buttons).forEach(([key, btn]: [string, any]) => {
          outputs[key] = { label: btn.title };
        });
      } else if (interaction?.interactive_type === 'list' && interaction.list_data?.sections) {
        interaction.list_data.sections.forEach((section, si) => {
          (section.rows || []).forEach((row, ri) => {
            const outputKey = `sections___${si}___rows___${ri}___title`;
            outputs[outputKey] = { label: row.title };
          });
        });
      } else if (interaction?.interactive_type === 'cta_url') {
        outputs['0'] = { label: interaction.cta_url?.display_text || 'CTA' };
      }
    } else if (nodeData.message_type === 'collect_input') {
      outputs['collect_input_output'] = { label: 'Continue' };
    } else {
      outputs['0'] = { label: 'Continue' };
    }

    operators[node.id] = {
      top: node.position.y,
      left: node.position.x,
      properties: { outputs },
    };
  });

  rfEdges.forEach((edge, idx) => {
    const fromConnector = mapSourceHandleToConnector(edge.sourceHandle ?? 'output');
    links[`link_${idx + 1}`] = {
      fromOperator: edge.source,
      fromConnector,
      toOperator: edge.target,
      toConnector: 0,
    };
  });

  return { operators, links };
}

function mapSourceHandleToConnector(sourceHandle: string): string | number {
  if (sourceHandle === 'output') return 0;
  if (sourceHandle === 'collect-output') return 'collect_input_output';
  if (sourceHandle.startsWith('btn-')) return sourceHandle.replace('btn-', '');
  if (sourceHandle.startsWith('list-')) {
    // list-s0-r0 → sections___0___rows___0___title
    return sourceHandle
      .replace('list-s', 'sections___')
      .replace('-r', '___rows___') + '___title';
  }
  return sourceHandle;
}

// =========================================================================
// MAIN PAGE
// =========================================================================

export default function BotFlowBuilder() {
  const { flowId } = useParams<{ flowId: string }>();
  const {
    setFlow,
    setNodes,
    setEdges,
    nodes,
    edges,
    isDirty,
    setIsSaving,
    setIsDirty,
    markSaved,
    reset,
    isSaving,
    pushHistory,
    flow,
  } = useBotFlowStore();

  // Warn on browser tab close / refresh when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Load flow on mount
  useEffect(() => {
    if (!flowId) return;
    reset();

    const load = async () => {
      try {
        const { flow, nodes: botNodes } = await botFlowService.getFlow(flowId);
        setFlow(flow);
        const { rfNodes, rfEdges } = botNodesToReactFlow(flow, botNodes);
        setNodes(rfNodes);
        setEdges(rfEdges);
        setIsDirty(false);
        pushHistory();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load flow');
      }
    };

    load();
    return () => reset();
  }, [flowId]);

  // Ctrl+S listener
  useEffect(() => {
    const handler = () => handleSave();
    document.addEventListener('flow-save', handler);
    return () => document.removeEventListener('flow-save', handler);
  }, [nodes, edges, flowId]);

  const handleSave = useCallback(async () => {
    if (!flowId) return;
    setIsSaving(true);
    try {
      const builderData = reactFlowToBuilderData(nodes, edges);
      await botFlowService.saveBuilder(flowId, { flow_chart_data: builderData });
      markSaved();
      toast.success('Flow saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  }, [flowId, nodes, edges, setIsSaving, markSaved]);

  if (!flowId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Invalid flow ID
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FlowHeader onSave={handleSave} />

      <ReactFlowProvider>
        <FlowCanvas flowUid={flowId} />
      </ReactFlowProvider>
    </div>
  );
}
