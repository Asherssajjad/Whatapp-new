import { Request } from 'express';
import {
  Role,
  BusinessType,
  MessageType,
  MessageDirection,
  ContactStatus,
  KnowledgeCategory,
  CampaignStatus,
  AutomationTrigger,
  AppointmentStatus,
  OrderStatus,
} from '@prisma/client';

export {
  Role,
  BusinessType,
  MessageType,
  MessageDirection,
  ContactStatus,
  KnowledgeCategory,
  CampaignStatus,
  AutomationTrigger,
  AppointmentStatus,
  OrderStatus,
};

export interface AuthPayload {
  userId: string;
  organizationId: string | null;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ─── WhatsApp Types ────────────────────────────────────────────────────────────

export interface WATextMessage {
  type: 'text';
  from: string;
  id: string;
  timestamp: string;
  text: { body: string };
}

export interface WAImageMessage {
  type: 'image';
  from: string;
  id: string;
  timestamp: string;
  image: { id: string; mime_type: string; sha256: string; caption?: string };
}

export interface WAAudioMessage {
  type: 'audio';
  from: string;
  id: string;
  timestamp: string;
  audio: { id: string; mime_type: string };
}

export interface WAInteractiveMessage {
  type: 'interactive';
  from: string;
  id: string;
  timestamp: string;
  interactive:
    | { type: 'button_reply'; button_reply: { id: string; title: string } }
    | { type: 'list_reply'; list_reply: { id: string; title: string; description?: string } };
}

export type WAIncomingMessage =
  | WATextMessage
  | WAImageMessage
  | WAAudioMessage
  | WAInteractiveMessage;

export interface WAContact {
  profile: { name: string };
  wa_id: string;
}

export interface WAWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: WAContact[];
      messages?: WAIncomingMessage[];
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

export interface WAWebhookPayload {
  object: string;
  entry: WAWebhookEntry[];
}

// ─── AI / OpenAI Types ─────────────────────────────────────────────────────────

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AIContext {
  organizationId: string;
  phoneNumberId: string;
  contactPhone: string;
  contactName?: string;
  messageHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  knowledgeContext: string;
  agentList: string;
  socialLinks: string;
  businessType: string;
  specialInstructions?: string;
  isAgentMode?: boolean;
  orgName?: string;
  websiteUrl?: string;
}

// ─── Vector / RAG Types ────────────────────────────────────────────────────────

export interface VectorSearchResult {
  id: string;
  content: string;
  similarity: number;
  knowledgeId: string;
}

// ─── Analytics Types ───────────────────────────────────────────────────────────

export interface DashboardAnalytics {
  totalContacts: number;
  hotLeads: number;
  escalations: number;
  messagesLast7Days: number;
  messagesLast30Days: number;
  appointmentsToday: number;
  aiDisabledContacts: number;
  topTagsByContact: Array<{ name: string; count: number; color: string }>;
  messageVolumeByDay: Array<{ date: string; inbound: number; outbound: number }>;
  leadScoreDistribution: Array<{ range: string; count: number }>;
  contactGrowth: Array<{ date: string; count: number }>;
}

// ─── Automation Types ──────────────────────────────────────────────────────────

export interface AutomationAction {
  type: string;
  data: Record<string, unknown>;
}

export interface AutomationTriggerData {
  keywords?: string[];
  threshold?: number;
  inactivityHours?: number;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Socket Events ─────────────────────────────────────────────────────────────

export interface SocketEvents {
  'new:message': {
    message: {
      id: string;
      phone: string;
      content: string;
      direction: string;
      type: string;
      isFromBot: boolean;
      createdAt: string;
      transcription?: string;
    };
    contact: {
      phone: string;
      name?: string;
      leadScore: number;
      isHotLead: boolean;
      status: string;
      lastMessageText: string;
      lastMessageAt: string;
    };
  };
  'contact:updated': { phone: string; organizationId: string; changes: Record<string, unknown> };
  'contact:deleted': { phone: string; organizationId: string };
  'lead:hot': { phone: string; name?: string; score: number; organizationId: string };
  'agent:escalated': { phone: string; agentName: string; organizationId: string };
  'campaign:progress': { campaignId: string; sent: number; total: number };
}
