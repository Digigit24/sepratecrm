// src/types/botFlowTypes.ts
// TypeScript types for Bot Flow Builder

// =========================================================================
// FLOW TYPES
// =========================================================================

export interface BotFlow {
  _uid: string;
  title: string;
  start_trigger: string;
  status: 1 | 2;
  is_active: boolean;
  node_count: number;
  flow_builder_data: FlowBuilderData | null;
  created_at: string;
  updated_at: string;
}

export interface FlowBuilderData {
  operators: Record<string, OperatorPosition>;
  links: Record<string, FlowLink>;
}

export interface OperatorPosition {
  top: number;
  left: number;
  properties?: {
    outputs?: Record<string, { label: string }>;
  };
}

export interface FlowLink {
  fromOperator: string;
  fromConnector: string | number;
  toOperator: string;
  toConnector: string | number;
}

// =========================================================================
// NODE TYPES
// =========================================================================

export type MessageType = 'simple' | 'interactive' | 'media' | 'template' | 'collect_input';
export type InteractiveType = 'button' | 'cta_url' | 'list';
export type MediaType = 'image' | 'video' | 'audio' | 'document';
export type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document';
export type ValidationType = 'none' | 'email' | 'phone' | 'number';

export interface BotButton {
  id: string;
  title: string;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface InteractionMessage {
  interactive_type: InteractiveType;
  media_link?: string;
  header_type: HeaderType;
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons?: Record<string, BotButton>;
  cta_url?: { display_text: string; url: string } | null;
  list_data?: {
    button_text: string;
    sections: ListSection[];
  } | null;
}

export interface MediaMessage {
  header_type: MediaType;
  media_link: string;
  caption?: string;
  file_name?: string;
}

export interface CollectInput {
  question: string;
  variable_name: string;
  validation: ValidationType;
  error_message?: string;
}

export interface TemplateMessage {
  template_uid: string;
  template_data?: any;
}

export interface BotNodeData {
  interaction_message?: InteractionMessage;
  media_message?: MediaMessage;
  collect_input?: CollectInput;
  template_message?: TemplateMessage;
}

export interface BotNode {
  _uid: string;
  name: string;
  reply_text: string;
  trigger_type: string;
  reply_trigger: string | null;
  message_type: MessageType;
  status: 1 | 2;
  bot_replies__id: number | null;
  __data: BotNodeData;
  created_at: string;
  updated_at: string;
}

// =========================================================================
// API PAYLOADS
// =========================================================================

export interface CreateFlowPayload {
  title: string;
  start_trigger: string;
}

export interface UpdateFlowPayload {
  title: string;
  start_trigger: string;
  status?: boolean;
}

export interface SaveBuilderPayload {
  flow_chart_data: FlowBuilderData;
}

export interface CreateSimpleNodePayload {
  name: string;
  message_type: 'simple';
  reply_text: string;
}

export interface CreateInteractiveNodePayload {
  name: string;
  message_type: 'interactive';
  reply_text: string;
  interactive_type: InteractiveType;
  header_type?: HeaderType;
  header_text?: string;
  footer_text?: string;
  buttons?: Record<string, BotButton>;
  button_display_text?: string;
  button_url?: string;
  list_button_text?: string;
  sections?: ListSection[];
}

export interface CreateMediaNodePayload {
  name: string;
  message_type: 'media';
  media_type: MediaType;
  media_url: string;
  caption?: string;
  file_name?: string;
}

export interface CreateCollectInputNodePayload {
  name: string;
  message_type: 'collect_input';
  collect_input_question: string;
  variable_name: string;
  collect_input_validation: ValidationType;
  collect_input_error_message?: string;
}

export interface CreateTemplateNodePayload {
  name: string;
  message_type: 'template';
  template_uid: string;
}

export type CreateNodePayload =
  | CreateSimpleNodePayload
  | CreateInteractiveNodePayload
  | CreateMediaNodePayload
  | CreateCollectInputNodePayload
  | CreateTemplateNodePayload;

export type UpdateNodePayload = CreateNodePayload;

// =========================================================================
// API RESPONSES
// =========================================================================

export interface BotFlowsListResponse {
  flows: BotFlow[];
  total: number;
}

export interface BotFlowResponse {
  flow: BotFlow;
  nodes: BotNode[];
}

export interface BotNodeResponse {
  node: BotNode;
}
