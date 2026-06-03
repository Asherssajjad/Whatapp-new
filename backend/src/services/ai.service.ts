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
      name: 'capture_order',
      description: 'Call this ONLY after you have collected all required customer details. Do not call until you have the customer name, phone, city, and product.',
      parameters: {
        type: 'object',
        required: ['productName', 'customerName', 'customerPhone', 'customerCity'],
        properties: {
          productName: { type: 'string', description: 'Product name and variant/color' },
          quantity: { type: 'number', description: 'Quantity (default 1)' },
          pricePerItem: { type: 'number', description: 'Price per item from knowledge base' },
          customerName: { type: 'string', description: 'Customer full name' },
          customerPhone: { type: 'string', description: 'Customer WhatsApp/phone number' },
          customerAddress: { type: 'string', description: 'Full delivery address' },
          customerCity: { type: 'string', description: 'City for delivery' },
          notes: { type: 'string', description: 'Special requests or notes' },
        },
      },
    },
  },
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
      description: 'Record enrollment/appointment after collecting customer name, phone, and service/course interest.',
      parameters: {
        type: 'object',
        required: ['customerName', 'customerPhone', 'serviceName'],
        properties: {
          customerName: { type: 'string', description: 'Customer full name' },
          customerPhone: { type: 'string', description: 'Customer phone number' },
          serviceName: { type: 'string', description: 'Course or service they want to enroll in' },
          preferredTiming: { type: 'string', description: 'Morning/Evening/Weekend preference' },
          notes: { type: 'string', description: 'Any additional details' },
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

  const businessName = ctx.orgName ?? 'our business';
  const website = ctx.websiteUrl ?? '';
  const isEcom = ctx.businessType === 'ECOMMERCE';

  return `You are the official WhatsApp sales assistant for ${businessName}.${website ? ` Website: ${website}` : ''}
${ctx.specialInstructions ? `\n${ctx.specialInstructions}` : ''}

LANGUAGE: Match the customer's language exactly. English = English reply. Roman Urdu = Roman Urdu. Hindi/Devanagari = Hindi reply. Short replies (2-4 sentences max). No emojis. No markdown. Plain URLs only. When unsure, share: ${website || 'the website'} instead of guessing.

VOICE MESSAGES: The customer may send voice messages which get transcribed. Transcription may include Hindi, Urdu, or English. Always understand the INTENT of what they said and respond accordingly — do not repeat generic company info if they are asking something specific.

${isEcom
? `PLACING AN ORDER:
When a customer wants to buy something, guide them through this naturally — one question at a time:
Ask ONE question per message — never ask for multiple details in one message.
Step 1: Confirm product/variant/color if not clear.
Step 2: Ask for full name only.
Step 3: Ask for phone number only. If they say "same number" or "ye wala" — use their WhatsApp number: ${ctx.contactPhone}.
Step 4: Ask for delivery address only.
Step 5: Ask for city only.
Step 6: Call capture_order tool. Confirm order is placed and team will contact within 24 hours.

IMPORTANT: If the customer gives multiple pieces of info in one message (e.g. "Name Ahmed, City Lahore"), extract all of it and skip asking for what was already given.`
: `BOOKING A SERVICE:
When a customer wants to book, hire, or use any service (appointment, consultation, treatment, repair, reservation, enrollment, etc.), guide them naturally — one question at a time:
Ask ONE question per message — never ask for name and phone in the same message.
Step 1: If service/need is not clear, ask what they need. Otherwise skip to step 2.
Step 2: Ask for their full name only.
Step 3: Ask for their phone number only. Note: if they say "same number", "ye wala", or "this number" — use their WhatsApp number which is ${ctx.contactPhone}.
Step 4: Ask for preferred date and time only.
Step 5: Once you have name, phone, and timing — call book_appointment tool immediately.
Step 6: Confirm booking is done.

IMPORTANT: If the customer provides name and/or phone in the same message, extract both and skip asking for what was already given. Do not ask again for information already provided.`}

ESCALATION: Agent requests / complaints / refunds → use escalate_to_agent tool immediately
ORDER/PAYMENT STATUS: You cannot access orders — ask customer to contact support or share website

Customer: ${ctx.contactName ?? 'Unknown'} (${ctx.contactPhone})

KNOWLEDGE BASE:
${ctx.knowledgeContext}

${ctx.agentList && ctx.agentList !== 'No agents configured.'
  ? `AGENTS (share when asked):\n${ctx.agentList}`
  : ''}
${ctx.socialLinks ? `Contact/Social: ${ctx.socialLinks}` : ''}`;
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
    case 'capture_order': {
      const qty = Number(args['quantity']) || 1;
      const price = Number(args['pricePerItem']) || 0;
      const addressNote = [
        args['customerAddress'] && `Address: ${String(args['customerAddress'])}`,
        args['customerCity'] && `City: ${String(args['customerCity'])}`,
        args['notes'] && String(args['notes']),
      ].filter(Boolean).join(' | ');

      const order = await prisma.order.create({
        data: {
          orderId: `ORD-${Date.now()}`,
          customerName: String(args['customerName']),
          phone: String(args['customerPhone'] ?? contactPhone),
          items: [{ product: String(args['productName']), quantity: qty, price }],
          total: qty * price,
          status: 'PENDING',
          notes: addressNote || undefined,
          organizationId,
        },
      });
      // Notify dashboard in real-time
      getIO().to(organizationId).emit('order:new', {
        order,
        organizationId,
        productName: String(args['productName']),
        customerPhone: contactPhone,
      });
      console.log(`[Order] New order captured: ${String(args['productName'])} for ${contactPhone}`);
      return `Order #${order.orderId} captured for ${String(args['customerName'])} — ${String(args['productName'])} x${qty}`;
    }

    case 'update_contact_profile': {
      const updateData: { name?: string; email?: string } = {};
      if (args['name']) updateData.name = String(args['name']);
      if (args['email']) updateData.email = String(args['email']);
      await prisma.contact.update({
        where: { phone_organizationId: { phone: contactPhone, organizationId } },
        data: updateData,
      });
      getIO().to(organizationId).emit('contact:updated', { phone: contactPhone, organizationId, changes: args });
      return `Profile updated: ${JSON.stringify(args)}`;
    }

    case 'book_appointment': {
      const apptNotes = [
        args['serviceName'] && `Course/Service: ${String(args['serviceName'])}`,
        args['preferredTiming'] && `Timing: ${String(args['preferredTiming'])}`,
        args['notes'] && String(args['notes']),
      ].filter(Boolean).join(' | ');

      const appt = await prisma.appointment.create({
        data: {
          customerName: String(args['customerName'] ?? contactPhone),
          phone: String(args['customerPhone'] ?? contactPhone),
          dateTime: new Date(),
          notes: apptNotes || undefined,
          organizationId,
        },
      });
      getIO().to(organizationId).emit('appointment:new', {
        appointment: appt,
        organizationId,
        customerName: appt.customerName,
        customerPhone: contactPhone,
      });
      console.log(`[Appointment] New booking: ${appt.customerName} (${contactPhone})`);
      return `Appointment recorded for ${appt.customerName}. Team will contact to confirm timing.`;
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
      // Mark as escalated but keep AI ON — human agent disables manually when they join
      await prisma.contact.update({
        where: { phone_organizationId: { phone: contactPhone, organizationId } },
        data: { isEscalated: true, escalatedAt: new Date(), status: 'ESCALATED' },
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
  const histCopy = [...ctx.messageHistory];
  const lastUserMsg = histCopy.reverse().find(m => m.role === 'user');
  const lastUserMessage = lastUserMsg?.content ?? '';
  const GREETINGS = /^(hi+|hello|hey|salam|salaam|assalam|assalamualaikum|wa alaikum|hii+|helo|hlo|aoa|ji\b|okay|ok\b|shukria|thanks|thank you|good morning|good evening|good night|bye|goodbye|tc\b|take care|👋|😊|🙏)/i;
  const queryStr = typeof lastUserMessage === 'string' ? lastUserMessage.trim() : '';
  const isGreeting = GREETINGS.test(queryStr) || queryStr.length < 10;

  // Skip knowledge search for greetings — webhook controller already limits history for greetings
  const knowledgeContext = isGreeting
    ? ''
    : await buildKnowledgeContext(queryStr, ctx.organizationId, 8);

  const fullCtx: AIContext = {
    organizationId: ctx.organizationId,
    phoneNumberId: ctx.phoneNumberId,
    contactPhone: ctx.contactPhone,
    contactName: ctx.contactName,
    messageHistory: ctx.messageHistory,
    knowledgeContext,
    agentList: ctx.agentList,
    socialLinks: ctx.socialLinks,
    businessType: ctx.businessType,
    specialInstructions: ctx.specialInstructions,
    orgName: ctx.orgName,
    websiteUrl: ctx.websiteUrl,
    isAgentMode: ctx.isAgentMode,
  };
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
