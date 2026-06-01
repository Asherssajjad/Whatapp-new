import dotenv from 'dotenv';
dotenv.config();

const optional = (key: string, fallback = ''): string => process.env[key] ?? fallback;

const warnIfMissing = (...keys: string[]): string => {
  for (const key of keys) {
    const val = process.env[key];
    if (val) return val;
  }
  console.warn(`⚠️  Missing env var: ${keys[0]} — some features will be disabled`);
  return '';
};

// Reads first key found — supports both new names and old names from legacy deployment
const compat = (newKey: string, ...oldKeys: string[]): string | undefined =>
  [newKey, ...oldKeys].reduce<string | undefined>((found, k) => found ?? process.env[k], undefined);

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  database: {
    url: optional('DATABASE_URL'),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'whatsapp_ai_secret_2026'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'whatsapp_ai_refresh_2026'),
    refreshExpiresIn: 30 * 24 * 60 * 60 * 1000,
  },

  openai: {
    // Supports legacy name APP_AI_TOKEN used by old deployment
    apiKey: warnIfMissing('OPENAI_API_KEY', 'APP_AI_TOKEN'),
    model: optional('OPENAI_MODEL', 'gpt-4o'),
    embeddingModel: optional('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    whisperModel: optional('OPENAI_WHISPER_MODEL', 'whisper-1'),
    maxTokens: parseInt(optional('OPENAI_MAX_TOKENS', '1000'), 10),
    temperature: parseFloat(optional('OPENAI_TEMPERATURE', '0.3')),
  },

  whatsapp: {
    verifyToken: optional('VERIFY_TOKEN', 'default_verify_token'),
    graphApiVersion: optional('GRAPH_API_VERSION', 'v21.0'),
    baseUrl: 'https://graph.facebook.com',
  },

  admin: {
    // Falls back to legacy hardcoded credentials if env vars not set
    email: optional('ADMIN_EMAIL', 'ashersajjad98@gmail.com'),
    password: optional('ADMIN_PASSWORD', 'AsherSajjad2026'),
    name: optional('ADMIN_NAME', 'Asher Sajjad'),
    whatsapp: process.env['ADMIN_WHATSAPP'],
  },

  cors: {
    origins: optional('CORS_ORIGINS', '*').split(','),
  },

  seed: {
    // Supports legacy names PHONE_NUMBER_ID / ACCESS_TOKEN / BUSINESS_TYPE / SPECIAL_INSTRUCTIONS
    orgName: compat('SEED_ORG_NAME', 'ORG_NAME') ?? 'My Business',
    phoneNumberId: compat('SEED_PHONE_NUMBER_ID', 'PHONE_NUMBER_ID')?.trim(),
    accessToken: compat('SEED_ACCESS_TOKEN', 'ACCESS_TOKEN')?.trim(),
    wabaId: compat('SEED_WABA_ID', 'WABA_ID')?.trim(),
    businessType: compat('SEED_BUSINESS_TYPE', 'BUSINESS_TYPE'),
    specialInstructions: compat('SEED_SPECIAL_INSTRUCTIONS', 'SPECIAL_INSTRUCTIONS'),
  },
} as const;
