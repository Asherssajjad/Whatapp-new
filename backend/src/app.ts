import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ─── Manual CORS (most reliable, bypasses cors package quirks) ─────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin ?? '';
  const allowed = config.cors.origins;

  if (allowed.includes('*') || allowed.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-org-id,Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Respond to preflight immediately
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// Security (after CORS so headers aren't overwritten)
app.use(helmet({ crossOriginResourcePolicy: false }));

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

// Webhook at root
app.get('/webhook', (req, res) => { void import('./controllers/webhook.controller').then(m => m.verifyWebhook(req, res)); });
app.post('/webhook', (req, res) => { void import('./controllers/webhook.controller').then(m => m.handleIncomingMessage(req, res)); });

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use(errorHandler);

export default app;
