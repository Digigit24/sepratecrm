// src/store/botFlowStore.ts
// Zustand store for Bot Flow Builder canvas state

import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { BotFlow, BotNode } from '@/types/botFlowTypes';

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

interface BotFlowStore {
  // Flow meta
  flowUid: string | null;
  flow: BotFlow | null;
  isDirty: boolean;

  // Canvas state
  nodes: Node[];
  edges: Edge[];

  // UI state
  selectedNodeId: string | null;
  isDrawerOpen: boolean;

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;

  // Loading states
  isSaving: boolean;

  // Actions — flow meta
  setFlow: (flow: BotFlow) => void;
  setIsDirty: (dirty: boolean) => void;

  // Actions — canvas
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;

  // Actions — UI
  selectNode: (nodeId: string | null) => void;
  closeDrawer: () => void;
  openDrawer: () => void;

  // Actions — history
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Actions — nodes
  addNode: (node: Node) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<BotNode>) => void;

  // Actions — save
  setIsSaving: (saving: boolean) => void;
  markSaved: () => void;

  // Reset
  reset: () => void;
}

const MAX_HISTORY = 50;

export const useBotFlowStore = create<BotFlowStore>((set, get) => ({
  flowUid: null,
  flow: null,
  isDirty: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDrawerOpen: false,
  history: [],
  historyIndex: -1,
  isSaving: false,

  setFlow: (flow) => set({ flow, flowUid: flow._uid }),

  setIsDirty: (dirty) => set({ isDirty: dirty }),

  setNodes: (nodes) => {
    if (typeof nodes === 'function') {
      set((state) => ({ nodes: nodes(state.nodes), isDirty: true }));
    } else {
      set({ nodes, isDirty: true });
    }
  },

  setEdges: (edges) => {
    if (typeof edges === 'function') {
      set((state) => ({ edges: edges(state.edges), isDirty: true }));
    } else {
      set({ edges, isDirty: true });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, isDrawerOpen: nodeId !== null }),

  closeDrawer: () => set({ isDrawerOpen: false, selectedNodeId: null }),

  openDrawer: () => set({ isDrawerOpen: true }),

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      historyIndex: historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({
      nodes: next.nodes,
      edges: next.edges,
      historyIndex: historyIndex + 1,
      isDirty: true,
    });
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node], isDirty: true }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDrawerOpen: state.selectedNodeId === nodeId ? false : state.isDrawerOpen,
      isDirty: true,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }));
  },

  setIsSaving: (saving) => set({ isSaving: saving }),

  markSaved: () => set({ isDirty: false }),

  reset: () =>
    set({
      flowUid: null,
      flow: null,
      isDirty: false,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDrawerOpen: false,
      history: [],
      historyIndex: -1,
      isSaving: false,
    }),
}));
