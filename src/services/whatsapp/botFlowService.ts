// src/services/whatsapp/botFlowService.ts
// Bot Flow Builder API Service — uses Laravel backend with vendor UID in URL

import { getWhatsappVendorUid } from '@/services/externalWhatsappService';
import type {
  BotFlow,
  BotNode,
  BotFlowsListResponse,
  BotFlowResponse,
  CreateFlowPayload,
  UpdateFlowPayload,
  SaveBuilderPayload,
  CreateNodePayload,
  UpdateNodePayload,
} from '@/types/botFlowTypes';
import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from '@/lib/apiConfig';
import { tokenManager } from '@/lib/client';
import { getWhatsappApiToken } from '@/services/externalWhatsappService';

// =========================================================================
// API CLIENT
// =========================================================================

const createBotFlowClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_CONFIG.WHATSAPP_EXTERNAL_BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getWhatsappApiToken() || tokenManager.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return client;
};

const botFlowClient = createBotFlowClient();

// =========================================================================
// HELPERS
// =========================================================================

interface ApiResponse<T = any> {
  result?: 'success' | 'failed';
  data?: T;
  message?: string;
}

function handleResponse<T>(response: { data: ApiResponse<T> }): T {
  const { data } = response;
  if (data.result === 'failed') {
    throw new Error(data.message || 'API request failed');
  }
  if (data.data !== undefined) return data.data as T;
  return data as unknown as T;
}

function vendorUrl(path: string): string {
  const vendorUid = getWhatsappVendorUid();
  if (!vendorUid) throw new Error('WhatsApp Vendor UID not configured');
  return `/${vendorUid}/bot-flows${path}`;
}

// =========================================================================
// FLOW OPERATIONS
// =========================================================================

async function listFlows(): Promise<BotFlowsListResponse> {
  const res = await botFlowClient.get(vendorUrl(''));
  return handleResponse<BotFlowsListResponse>(res);
}

async function createFlow(payload: CreateFlowPayload): Promise<BotFlow> {
  const res = await botFlowClient.post(vendorUrl(''), payload);
  const data = handleResponse<{ flow: BotFlow }>(res);
  return data.flow;
}

async function getFlow(flowUid: string): Promise<BotFlowResponse> {
  const res = await botFlowClient.get(vendorUrl(`/${flowUid}`));
  return handleResponse<BotFlowResponse>(res);
}

async function updateFlow(flowUid: string, payload: UpdateFlowPayload): Promise<void> {
  const res = await botFlowClient.put(vendorUrl(`/${flowUid}`), payload);
  handleResponse(res);
}

async function deleteFlow(flowUid: string): Promise<void> {
  const res = await botFlowClient.delete(vendorUrl(`/${flowUid}`));
  handleResponse(res);
}

async function saveBuilder(flowUid: string, payload: SaveBuilderPayload): Promise<void> {
  const res = await botFlowClient.post(vendorUrl(`/${flowUid}/save-builder`), payload);
  handleResponse(res);
}

async function toggleStatus(flowUid: string, active: boolean): Promise<void> {
  const res = await botFlowClient.post(vendorUrl(`/${flowUid}/toggle-status`), { active });
  handleResponse(res);
}

// =========================================================================
// NODE OPERATIONS
// =========================================================================

async function listNodes(flowUid: string): Promise<BotNode[]> {
  const res = await botFlowClient.get(vendorUrl(`/${flowUid}/nodes`));
  const data = handleResponse<{ nodes: BotNode[] }>(res);
  return data.nodes;
}

async function createNode(flowUid: string, payload: CreateNodePayload): Promise<BotNode> {
  const res = await botFlowClient.post(vendorUrl(`/${flowUid}/nodes`), payload);
  const data = handleResponse<{ node: BotNode }>(res);
  return data.node;
}

async function getNode(flowUid: string, nodeUid: string): Promise<BotNode> {
  const res = await botFlowClient.get(vendorUrl(`/${flowUid}/nodes/${nodeUid}`));
  const data = handleResponse<{ node: BotNode }>(res);
  return data.node;
}

async function updateNode(flowUid: string, nodeUid: string, payload: UpdateNodePayload): Promise<BotNode> {
  const res = await botFlowClient.put(vendorUrl(`/${flowUid}/nodes/${nodeUid}`), payload);
  const data = handleResponse<{ node: BotNode }>(res);
  return data.node;
}

async function deleteNode(flowUid: string, nodeUid: string): Promise<void> {
  const res = await botFlowClient.delete(vendorUrl(`/${flowUid}/nodes/${nodeUid}`));
  handleResponse(res);
}

async function duplicateNode(flowUid: string, nodeUid: string): Promise<BotNode> {
  const res = await botFlowClient.post(vendorUrl(`/${flowUid}/nodes/${nodeUid}/duplicate`));
  const data = handleResponse<{ node: BotNode }>(res);
  return data.node;
}

export const botFlowService = {
  listFlows,
  createFlow,
  getFlow,
  updateFlow,
  deleteFlow,
  saveBuilder,
  toggleStatus,
  listNodes,
  createNode,
  getNode,
  updateNode,
  deleteNode,
  duplicateNode,
};
