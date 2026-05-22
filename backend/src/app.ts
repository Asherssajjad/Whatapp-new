import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: config.cors.origins, credentials: true }));

// Rate limiting (skip webhook)
app.use(
  /^(?!\/webhook)/,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
);

// Body parsing
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', router);

// Webhook at root (Meta sends to /webhook)
app.get('/webhook', (req, res) => { void import('./controllers/webhook.controller').then(m => m.verifyWebhook(req, res)); });
app.post('/webhook', (req, res) => { void import('./controllers/webhook.controller').then(m => m.handleIncomingMessage(req, res)); });

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use(errorHandler);

export default app;
