import { prisma } from '../lib/prisma';
import { chatCompletion, analyzeImage } from './openai.service';
import { buildKnowledgeContext } from './vector.service';
import { createWAService } from './whatsapp.service';
import { getIO } from './socket.service';
import type { AIContext, AITool, AIToolCall } from '../types';

// ─── Tool Definitions ──────────────────────────────────────────────────────────

const AI_TOOLS: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'update_contact_profile',
      description: 'Save or update the customer\'s name and/or email',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer\'s full name' },
          email: { type: 'string', description: 'Customer\'s email address' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment for the customer',
      parameters: {
        type: 'object',
        required: ['customerName', 'dateTime'],
        properties: {
          customerName: { type: 'string' },
          dateTime: { type: 'string', description: 'ISO 8601 datetime' },
          notes: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_buttons',
      description: 'Send an interactive button menu to the customer',
      parameters: {
        type: 'object',
        required: ['bodyText', 'buttons'],
        properties: {
          headerText: { type: 'string' },
          bodyText: { type: 'string' },
          footerText: { type: 'string' },
          buttons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
              required: ['id', 'title'],
            },
            maxItems: 3,
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_list',
      description: 'Send an interactive list menu to the customer',
      parameters: {
        type: 'object',
        required: ['bodyText', 'buttonText', 'sections'],
        properties: {
          headerText: { type: 'string' },
          bodyText: { type: 'string' },
          footerText: { type: 'string' },
          buttonText: { type: 'string' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['id', 'title'],
                  },
                },
              },
              required: ['title', 'rows'],
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_agent',
      description: 'Hand off this conversation to a human agent',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason for escalation' },
          summary: { type: 'string', description: 'Brief summary for the agent' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_score',
      description: 'Update the lead score of the customer (additive)',
      parameters: {
        type: 'object',
        required: ['delta'],
        properties: {
          delta: { type: 'number', description: 'Points to add (positive) or subtract (negative)' },
          reason: { type: 'string' },
        },
      },
    },
  },
];

// ─── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AIContext): string {
  if (ctx.isAgentMode) {
    return `You are an internal AI coordinator briefing a human support agent.
Customer Phone: ${ctx.contactPhone}
Customer Name: ${ctx.contactName ?? 'Unknown'}

## Conversation Summary
${ctx.messageHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

## Knowledge Available
${ctx.knowledgeContext}

Provide a brief, professional handoff note covering: customer issue, relevant info from knowledge base, and recommended next steps. Be concise.`;
  }

  return `You are a smart, friendly customer support assistant for a ${ctx.businessType} business.
Communicate in a mix of Roman Urdu and English — warm, professional, and helpful.
Never be rude, never make up information, and always stay on-brand.

## Customer Context
Phone: ${ctx.contactPhone}
Name: ${ctx.contactName ?? 'Not provided'}

## Knowledge Base
${ctx.knowledgeContext}

## Available Agents
${ctx.agentList || 'No agents currently available.'}

## Social / Contact Links
${ctx.socialLinks || 'Not configured.'}

${ctx.specialInstructions ? `## Special Instructions\n${ctx.specialInstructions}` : ''}

## Rules
- Only answer questions related to our business
- Use tools when appropriate (book appointments, show menus, escalate)
- If you don't know something, say so honestly and offer to escalate
- Keep responses concise — WhatsApp users prefer short messages
- Use bullet points sparingly; prefer natural conversational text`;
}

// ─── Tool Execution ────────────────────────────────────────────────────────────

interface ToolContext {
  organizationId: string;
  contactPhone: string;
  waService: ReturnType<typeof createWAService>;
  conversationId: string;
}

async function executeTool(
  toolCall: AIToolCall,
  ctx: ToolContext
): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  const { organizationId, contactPhone, waService, conversationId } = ctx;

  switch (toolCall.function.name) {
    case 'update_contact_profile': {
      await prisma.contact.update({
        where: { phone_organizationId: { phone: contactPhone, organizationId } },
        data: {
          ...(args['name'] && { name: String(args['name']) }),
          ...(args['email'] && { email: String(args['email']) }),
        },
      });
      getIO().to(organizationId).emit('contact:updated', { phone: contactPhone, organizationId, changes: args });
      return `Profile updated: ${JSON.stringify(args)}`;
    }

    case 'book_appointment': {
      const appt = await prisma.appointment.create({
        data: {
          customerName: String(args['customerName']),
          phone: contactPhone,
          dateTime: new Date(String(args['dateTime'])),
          notes: args['notes'] ? String(args['notes']) : undefined,
          organizationId,
        },
      });
      return `Appointment booked for ${appt.customerName} on ${appt.dateTime.toISOString()}`;
    }

    case 'send_buttons': {
      await waService.sendButtons({
        to: contactPhone,
        headerText: args['headerText'] ? String(args['headerText']) : undefined,
        bodyText: String(args['bodyText']),
        footerText: args['footerText'] ? String(args['footerText']) : undefined,
        buttons: (args['buttons'] as Array<{ id: string; title: string }>),
      });
      return 'Interactive buttons sent.';
    }

    case 'send_list': {
      await waService.sendList({
        to: contactPhone,
        headerText: args['headerText'] ? String(args['headerText']) : undefined,
        bodyText: String(args['bodyText']),
        footerText: args['footerText'] ? String(args['footerText']) : undefined,
        buttonText: String(args['buttonText']),
        sections: args['sections'] as Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
      });
      return 'List menu sent.';
    }

    case 'escalate_to_agent': {
      // Mark contact as escalated
      await prisma.contact.update({
        where: { phone_organizationId: { phone: contactPhone, organizationId } },
        data: { isEscalated: true, escalatedAt: new Date(), aiEnabled: false, status: 'ESCALATED' },
      });

      // Notify first available agent
      const agent = await prisma.agent.findFirst({
        where: { organizationId, isAvailable: true },
      });

      if (agent) {
        const agentWa = await prisma.whatsAppNumber.findFirst({ where: { organizationId, isActive: true } });
        if (agentWa) {
          const agentService = createWAService(agentWa);
          await agentService.sendText({
            to: agent.phone,
            body: `🚨 *Escalation Alert*\n\nCustomer: ${contactPhone}\nReason: ${String(args['reason'])}\nSummary: ${String(args['summary'] ?? 'No summary')}`,
          });
        }
        getIO().to(organizationId).emit('agent:escalated', {
          phone: contactPhone,
          agentName: agent.name,
          organizationId,
        });
      }

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { isOpen: true, summary: String(args['summary'] ?? '') },
      });

      return `Escalated. Reason: ${String(args['reason'])}`;
    }

    case 'update_lead_score': {
      const delta = Number(args['delta']) || 0;
      const contact = await prisma.contact.update({
        where: { phone_organizationId: { phone: contactPhone, organizationId } },
        data: { leadScore: { increment: delta } },
      });

      if (contact.leadScore >= 50 && !contact.isHotLead) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { isHotLead: true },
        });
        getIO().to(organizationId).emit('lead:hot', {
          phone: contactPhone,
          name: contact.name ?? undefined,
          score: contact.leadScore,
          organizationId,
        });
      }

      return `Lead score updated by ${delta}. New score: ${contact.leadScore}`;
    }

    default:
      return `Unknown tool: ${toolCall.function.name}`;
  }
}

// ─── Main AI Response Generator ────────────────────────────────────────────────

export async function generateAIResponse(
  ctx: AIContext & {
    organizationId: string;
    phoneNumberId: string;
    waNumber: { phoneNumberId: string; accessToken: string };
    conversationId: string;
    imageBuffer?: Buffer;
    imageMimeType?: string;
  }
): Promise<string | null> {
  // Build knowledge context
  const lastUserMessage = ctx.messageHistory.findLast(m => m.role === 'user')?.content ?? '';
  const knowledgeContext = await buildKnowledgeContext(
    typeof lastUserMessage === 'string' ? lastUserMessage : '',
    ctx.organizationId
  );

  const fullCtx: AIContext = { ...ctx, knowledgeContext };
  const systemPrompt = buildSystemPrompt(fullCtx);

  const waService = createWAService(ctx.waNumber);

  // Build messages array
  const messages: Parameters<typeof chatCompletion>[0]['messages'] = [
    { role: 'system', content: systemPrompt },
    ...ctx.messageHistory.slice(-20).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Inject image if present
  if (ctx.imageBuffer && ctx.imageMimeType) {
    const base64 = ctx.imageBuffer.toString('base64');
    const imageDesc = await analyzeImage(base64, ctx.imageMimeType, lastUserMessage as string);
    // Append image description to the last user message
    const lastIdx = messages.length - 1;
    if (messages[lastIdx]?.role === 'user') {
      messages[lastIdx] = {
        role: 'user',
        content: `${messages[lastIdx].content}\n[Image attached: ${imageDesc}]`,
      };
    }
  }

  // First AI call
  const toolCtx: ToolContext = {
    organizationId: ctx.organizationId,
    contactPhone: ctx.contactPhone,
    waService,
    conversationId: ctx.conversationId,
  };

  let result = await chatCompletion({
    messages,
    tools: ctx.isAgentMode ? undefined : AI_TOOLS,
  });

  // Tool call loop (max 3 rounds)
  let rounds = 0;
  while (result.toolCalls && result.toolCalls.length > 0 && rounds < 3) {
    const toolResults: Parameters<typeof chatCompletion>[0]['messages'] = [];

    for (const tc of result.toolCalls) {
      const toolResult = await executeTool(tc, toolCtx);
      toolResults.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: tc.id,
      });
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: result.content ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_calls: result.toolCalls as any,
    });
    messages.push(...toolResults);

    result = await chatCompletion({ messages, tools: AI_TOOLS });
    rounds++;
  }

  return result.content;
}

// ─── Lead Score from Keywords ──────────────────────────────────────────────────

const HOT_KEYWORDS = [
  'buy', 'purchase', 'order', 'price', 'cost', 'book', 'reserve', 'interested',
  'khareedno', 'price batao', 'khareedna', 'order karna', 'abhi chahiye',
];

export function calculateLeadScoreDelta(message: string): number {
  const lower = message.toLowerCase();
  let delta = 1; // base increment per message
  for (const kw of HOT_KEYWORDS) {
    if (lower.includes(kw)) delta += 10;
  }
  return delta;
}
