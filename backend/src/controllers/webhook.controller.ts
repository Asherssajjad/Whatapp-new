import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { generateAIResponse, calculateLeadScoreDelta } from '../services/ai.service';
import { createWAService } from '../services/whatsapp.service';
import { processVoiceMessage } from '../services/voice.service';
import { runAutomations } from '../services/automation.service';
import { getIO } from '../services/socket.service';
import type { WAWebhookPayload, WAIncomingMessage, WAContact } from '../types';

export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Verification failed' });
  }
}

export async function handleIncomingMessage(req: Request, res: Response): Promise<void> {
  res.status(200).json({ status: 'ok' }); // Acknowledge immediately

  try {
    const payload = req.body as WAWebhookPayload;
    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        const { value } = change;

        // Handle status updates
        if (value.statuses?.length) {
          await handleStatusUpdate(value.statuses, value.metadata.phone_number_id);
          continue;
        }

        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];
        const phoneNumberId = value.metadata.phone_number_id;

        for (const msg of messages) {
          await processMessage(msg, contacts, phoneNumberId);
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Error processing payload:', err);
  }
}

async function handleStatusUpdate(
  statuses: Array<{ id: string; status: string; recipient_id: string }>,
  phoneNumberId: string
): Promise<void> {
  for (const s of statuses) {
    const statusMap: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    const mapped = statusMap[s.status];
    if (!mapped) continue;

    await prisma.message
      .updateMany({
        where: { metaMessageId: s.id },
        data: { status: mapped },
      })
      .catch(() => null);

    void phoneNumberId; // used for context but not needed for DB update
  }
}

async function processMessage(
  msg: WAIncomingMessage,
  contacts: WAContact[],
  phoneNumberId: string
): Promise<void> {
  const senderPhone = msg.from;
  const waContact = contacts.find(c => c.wa_id === senderPhone);
  const senderName = waContact?.profile?.name;

  // Find the WhatsApp number record
  const waNumber = await prisma.whatsAppNumber.findUnique({
    where: { phoneNumberId },
    include: { organization: true },
  });

  if (!waNumber) {
    console.warn(`[Webhook] Unknown phone_number_id: ${phoneNumberId}`);
    return;
  }

  const { organizationId, organization } = waNumber;
  const waService = createWAService(waNumber);

  // Mark as read
  await waService.markAsRead(msg.id);

  // Upsert contact
  const contact = await prisma.contact.upsert({
    where: { phone_organizationId: { phone: senderPhone, organizationId } },
    create: {
      phone: senderPhone,
      name: senderName,
      organizationId,
      whatsappNumberId: waNumber.id,
      lastMessageAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
      ...(senderName && !( await prisma.contact.findUnique({ where: { phone_organizationId: { phone: senderPhone, organizationId } } }) )?.name && { name: senderName }),
    },
  });

  // Get or create conversation
  let conversation = await prisma.conversation.findFirst({
    where: { phone: senderPhone, organizationId, isOpen: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        phone: senderPhone,
        organizationId,
        whatsappNumberId: waNumber.id,
        contactId: contact.id,
      },
    });
    // Trigger new_contact automations
    await runAutomations('NEW_CONTACT', organizationId, { phone: senderPhone });
  }

  // Extract message content
  let textContent = '';
  let messageType: 'TEXT' | 'IMAGE' | 'VOICE' | 'INTERACTIVE' = 'TEXT';
  let transcription: string | undefined;
  let imageBuffer: Buffer | undefined;
  let imageMimeType: string | undefined;

  if (msg.type === 'text') {
    textContent = msg.text.body;
    messageType = 'TEXT';
  } else if (msg.type === 'interactive') {
    const inter = msg.interactive;
    textContent = inter.type === 'button_reply'
      ? inter.button_reply.title
      : inter.list_reply.title;
    messageType = 'INTERACTIVE';
  } else if (msg.type === 'audio') {
    messageType = 'VOICE';
    try {
      const { url } = await waService.downloadMedia(msg.audio.id);
      const buffer = await waService.downloadMediaBuffer(url);
      const { transcript } = await processVoiceMessage(buffer, msg.audio.mime_type);
      textContent = transcript;
      transcription = transcript;
    } catch (err) {
      console.error('[Webhook] Voice processing error:', err);
      textContent = '[Voice message - could not transcribe]';
    }
  } else if (msg.type === 'image') {
    messageType = 'IMAGE';
    textContent = msg.image.caption ?? '[Image]';
    try {
      const { url, mimeType } = await waService.downloadMedia(msg.image.id);
      imageBuffer = await waService.downloadMediaBuffer(url);
      imageMimeType = mimeType;
    } catch {
      // non-critical
    }
  } else {
    const unknownMsg = msg as { type?: string };
    textContent = `[${unknownMsg.type ?? 'unknown'} message]`;
  }

  // Save inbound message
  const savedMessage = await prisma.message.create({
    data: {
      metaMessageId: msg.id,
      phone: senderPhone,
      content: textContent,
      type: messageType,
      direction: 'INBOUND',
      status: 'DELIVERED',
      isFromBot: false,
      transcription,
      conversationId: conversation.id,
      whatsappNumberId: waNumber.id,
    },
  });

  // Update contact last message
  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastMessageText: textContent.slice(0, 255), lastMessageAt: new Date() },
  });

  // Lead scoring
  const scoreDelta = calculateLeadScoreDelta(textContent);
  const updatedContact = await prisma.contact.update({
    where: { id: contact.id },
    data: { leadScore: { increment: scoreDelta } },
  });

  if (updatedContact.leadScore >= 50 && !updatedContact.isHotLead) {
    await prisma.contact.update({ where: { id: contact.id }, data: { isHotLead: true } });
    getIO().to(organizationId).emit('lead:hot', {
      phone: senderPhone,
      name: updatedContact.name ?? undefined,
      score: updatedContact.leadScore,
      organizationId,
    });
  }

  // Emit to dashboard
  getIO().to(organizationId).emit('new:message', {
    message: {
      id: savedMessage.id,
      phone: senderPhone,
      content: textContent,
      direction: 'INBOUND',
      type: messageType,
      isFromBot: false,
      createdAt: savedMessage.createdAt.toISOString(),
      transcription,
    },
    contact: {
      phone: senderPhone,
      name: updatedContact.name,
      leadScore: updatedContact.leadScore,
      isHotLead: updatedContact.isHotLead || updatedContact.leadScore >= 50,
      status: updatedContact.status,
      lastMessageText: textContent.slice(0, 255),
      lastMessageAt: new Date().toISOString(),
    },
  });

  // Skip AI if disabled, escalated, or message limit reached
  if (!contact.aiEnabled || contact.isEscalated || contact.status === 'ESCALATED') return;
  if (organization.messageCount >= organization.messageLimit) return;

  // Check keyword automations
  await runAutomations('KEYWORD_MATCH', organizationId, { phone: senderPhone, message: textContent });

  // Build message history
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });

  const messageHistory = history.map(m => ({
    role: (m.isFromBot ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.transcription ?? m.content,
  }));

  // Get agents and social links for context
  const agents = await prisma.agent.findMany({ where: { organizationId } });
  const socialLinks = await prisma.socialLink.findMany({ where: { organizationId } });

  const agentList = agents.map(a => `- ${a.name} (${a.phone})`).join('\n') || 'No agents configured.';
  const socialLinksStr = socialLinks.map(s => `${s.platform}: ${s.url}`).join('\n') || 'Not configured.';

  // Generate AI reply
  try {
    const aiReply = await generateAIResponse({
      organizationId,
      phoneNumberId,
      contactPhone: senderPhone,
      contactName: contact.name ?? undefined,
      messageHistory,
      knowledgeContext: '', // will be built inside generateAIResponse
      agentList,
      socialLinks: socialLinksStr,
      businessType: organization.businessType,
      specialInstructions: organization.specialInstructions ?? undefined,
      waNumber,
      conversationId: conversation.id,
      imageBuffer,
      imageMimeType,
    });

    if (!aiReply) return;

    // Send AI response
    await waService.sendText({ to: senderPhone, body: aiReply });

    // Save bot message
    const botMessage = await prisma.message.create({
      data: {
        phone: senderPhone,
        content: aiReply,
        type: 'TEXT',
        direction: 'OUTBOUND',
        status: 'SENT',
        isFromBot: true,
        conversationId: conversation.id,
        whatsappNumberId: waNumber.id,
      },
    });

    // Increment message count
    await prisma.organization.update({
      where: { id: organizationId },
      data: { messageCount: { increment: 1 } },
    });

    // Emit bot reply to dashboard
    getIO().to(organizationId).emit('new:message', {
      message: {
        id: botMessage.id,
        phone: senderPhone,
        content: aiReply,
        direction: 'OUTBOUND',
        type: 'TEXT',
        isFromBot: true,
        createdAt: botMessage.createdAt.toISOString(),
      },
      contact: {
        phone: senderPhone,
        name: contact.name,
        leadScore: updatedContact.leadScore,
        isHotLead: updatedContact.isHotLead,
        status: updatedContact.status,
        lastMessageText: aiReply.slice(0, 255),
        lastMessageAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[Webhook] AI reply error:', err);
  }
}
