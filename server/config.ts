import dotenv from 'dotenv';

dotenv.config();

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  ecotrack: {
    baseUrl: process.env.ECOTRACK_BASE_URL ?? 'https://world-express.ecotrack.dz/api/v1',
    apiKey: process.env.ECOTRACK_API_KEY ?? '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
    serviceAccountJsonB64: process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 ?? '',
  },
  alerts: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL ?? '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
    twilioAdminNumber: process.env.TWILIO_ADMIN_NUMBER ?? '',
    twilioToNumbers: process.env.TWILIO_TO_NUMBERS ?? '',
  },
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  seedProducts: process.env.SEED_PRODUCTS !== 'false',
};

export const assertServerConfig = () => {
  required(
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64
  );
};
