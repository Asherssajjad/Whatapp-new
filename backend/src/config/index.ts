import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),

  database: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'whatsapp_ai_secret_2026'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'whatsapp_ai_refresh_2026'),
    refreshExpiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  },

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: optional('OPENAI_MODEL', 'gpt-4o'),
    embeddingModel: optional('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    whisperModel: optional('OPENAI_WHISPER_MODEL', 'whisper-1'),
    maxTokens: parseInt(optional('OPENAI_MAX_TOKENS', '1000'), 10),
    temperature: parseFloat(optional('OPENAI_TEMPERATURE', '0.3')),
  },

  whatsapp: {
    verifyToken: required('VERIFY_TOKEN'),
    graphApiVersion: optional('GRAPH_API_VERSION', 'v21.0'),
    baseUrl: 'https://graph.facebook.com',
  },

  admin: {
    email: optional('ADMIN_EMAIL', 'admin@whatsappbot.com'),
    password: optional('ADMIN_PASSWORD', 'Admin@2026'),
    name: optional('ADMIN_NAME', 'Super Admin'),
    whatsapp: process.env['ADMIN_WHATSAPP'],
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3000').split(','),
  },

  seed: {
    orgName: process.env['SEED_ORG_NAME'],
    phoneNumberId: process.env['SEED_PHONE_NUMBER_ID'],
    accessToken: process.env['SEED_ACCESS_TOKEN'],
    wabaId: process.env['SEED_WABA_ID'],
    businessType: process.env['SEED_BUSINESS_TYPE'],
    specialInstructions: process.env['SEED_SPECIAL_INSTRUCTIONS'],
  },
} as const;
