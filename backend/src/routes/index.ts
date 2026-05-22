import { Router } from 'express';
import { verifyWebhook, handleIncomingMessage } from '../controllers/webhook.controller';
import { login, refreshToken, getMe, changePassword, logout } from '../controllers/auth.controller';
import {
  getContacts, getContact, getMessages, sendManualMessage,
  toggleAI, deleteContact, updateContact, getAnalytics, getHandoffs,
} from '../controllers/chat.controller';
import {
  getKnowledgeBases, ingestURL, ingestManual, deleteKnowledge, toggleKnowledge,
} from '../controllers/knowledge.controller';
import {
  getNumbers, addNumber, updateNumber, setPrimary, deleteNumber,
} from '../controllers/number.controller';
import {
  getAutomations, createAutomation, updateAutomation, deleteAutomation,
  getCampaigns, createCampaign, launchCampaign, deleteCampaign,
  scheduleMessage, getAgents, addAgent, updateAgent, deleteAgent,
} from '../controllers/automation.controller';
import {
  getOrganizations, createOrganization, updateOrganization, deleteOrganization,
  getUsers, createUser, deleteUser, getSystemStats,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ─── Webhook (public) ──────────────────────────────────────────────────────────
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleIncomingMessage);

// ─── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/login', login);
router.post('/auth/refresh', refreshToken);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticate, getMe);
router.put('/auth/password', authenticate, changePassword);

// ─── Chat / Contacts ───────────────────────────────────────────────────────────
router.get('/contacts', authenticate, getContacts);
router.get('/contacts/:phone', authenticate, getContact);
router.put('/contacts/:phone', authenticate, updateContact);
router.delete('/contacts/:phone', authenticate, deleteContact);
router.get('/contacts/:phone/messages', authenticate, getMessages);
router.post('/contacts/:phone/toggle-ai', authenticate, toggleAI);
router.post('/messages/send', authenticate, sendManualMessage);
router.get('/analytics', authenticate, getAnalytics);
router.get('/handoffs', authenticate, getHandoffs);

// ─── Knowledge ─────────────────────────────────────────────────────────────────
router.get('/knowledge', authenticate, getKnowledgeBases);
router.post('/knowledge/url', authenticate, ingestURL);
router.post('/knowledge/manual', authenticate, ingestManual);
router.delete('/knowledge/:id', authenticate, deleteKnowledge);
router.patch('/knowledge/:id/toggle', authenticate, toggleKnowledge);

// ─── WhatsApp Numbers ──────────────────────────────────────────────────────────
router.get('/numbers', authenticate, getNumbers);
router.post('/numbers', authenticate, addNumber);
router.put('/numbers/:id', authenticate, updateNumber);
router.patch('/numbers/:id/primary', authenticate, setPrimary);
router.delete('/numbers/:id', authenticate, deleteNumber);

// ─── Automations ───────────────────────────────────────────────────────────────
router.get('/automations', authenticate, getAutomations);
router.post('/automations', authenticate, createAutomation);
router.put('/automations/:id', authenticate, updateAutomation);
router.delete('/automations/:id', authenticate, deleteAutomation);

// ─── Campaigns ─────────────────────────────────────────────────────────────────
router.get('/campaigns', authenticate, getCampaigns);
router.post('/campaigns', authenticate, createCampaign);
router.post('/campaigns/:id/launch', authenticate, launchCampaign);
router.delete('/campaigns/:id', authenticate, deleteCampaign);

// ─── Scheduled Messages ────────────────────────────────────────────────────────
router.post('/scheduled-messages', authenticate, scheduleMessage);

// ─── Agents ────────────────────────────────────────────────────────────────────
router.get('/agents', authenticate, getAgents);
router.post('/agents', authenticate, addAgent);
router.put('/agents/:id', authenticate, updateAgent);
router.delete('/agents/:id', authenticate, deleteAgent);

// ─── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats', authenticate, requireRole('SUPER_ADMIN'), getSystemStats);
router.get('/admin/organizations', authenticate, requireRole('SUPER_ADMIN'), getOrganizations);
router.post('/admin/organizations', authenticate, requireRole('SUPER_ADMIN'), createOrganization);
router.put('/admin/organizations/:id', authenticate, requireRole('SUPER_ADMIN'), updateOrganization);
router.delete('/admin/organizations/:id', authenticate, requireRole('SUPER_ADMIN'), deleteOrganization);
router.get('/admin/users', authenticate, requireRole('SUPER_ADMIN'), getUsers);
router.post('/admin/users', authenticate, requireRole('SUPER_ADMIN'), createUser);
router.delete('/admin/users/:id', authenticate, requireRole('SUPER_ADMIN'), deleteUser);

export default router;
