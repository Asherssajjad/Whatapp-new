import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ─── CORS — must be first, no conditions ──────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin,Content-Type,Accept,Authorization,x-org-id');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

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
