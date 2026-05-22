export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'AGENT';
  organizationId: string | null;
  avatar: string | null;
  organization?: Organization;
}

export interface Organization {
  id: string;
  name: string;
  businessType: 'SERVICES' | 'ECOMMERCE' | 'GENERAL';
  websiteUrl: string | null;
  specialInstructions: string | null;
  messageLimit: number;
  messageCount: number;
  whatsappNumbers: WhatsAppNumber[];
}

export interface WhatsAppNumber {
  id: string;
  label: string;
  phoneNumberId: string;
  phoneNumber: string | null;
  isActive: boolean;
  isPrimary: boolean;
  _count?: { contacts: number; messages: number };
}

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  avatar: string | null;
  email: string | null;
  notes: string | null;
  leadScore: number;
  isHotLead: boolean;
  status: 'ACTIVE' | 'ESCALATED' | 'RESOLVED' | 'BLOCKED';
  aiEnabled: boolean;
  isEscalated: boolean;
  escalatedAt: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  organizationId: string;
  tags: Array<{ tag: Tag }>;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  phone: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VOICE' | 'VIDEO' | 'DOCUMENT' | 'INTERACTIVE' | 'TEMPLATE' | 'SYSTEM';
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  isFromBot: boolean;
  transcription: string | null;
  createdAt: string;
}

export interface Knowledge {
  id: string;
  title: string;
  source: 'URL' | 'FILE' | 'MANUAL';
  sourceUrl: string | null;
  category: 'GENERAL' | 'SERVICES' | 'ECOMMERCE' | 'FAQ' | 'PRICING';
  isActive: boolean;
  createdAt: string;
  _count?: { chunks: number };
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  scheduledAt: string | null;
  sentAt: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerData: Record<string, unknown> | null;
  actions: unknown[];
  isActive: boolean;
  runCount: number;
  createdAt: string;
}

export interface Analytics {
  totalContacts: number;
  hotLeads: number;
  escalations: number;
  aiDisabledContacts: number;
  messagesLast7Days: number;
  messagesLast30Days: number;
  appointmentsToday: number;
  topTagsByContact: Array<{ name: string; count: number; color: string }>;
  contactGrowth: Array<{ createdAt: string; _count: number }>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SocketNewMessage {
  message: {
    id: string; phone: string; content: string;
    direction: 'INBOUND' | 'OUTBOUND'; type: string;
    isFromBot: boolean; createdAt: string; transcription?: string;
  };
  contact: {
    phone: string; name: string | null; leadScore: number;
    isHotLead: boolean; status: string;
    lastMessageText: string; lastMessageAt: string;
  };
}
