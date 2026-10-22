const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from server root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3002,
  nodeEnv: process.env.NODE_ENV || 'production',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  clientUrl: process.env.CLIENT_URL || process.env.APP_BASE_URL || 'https://egates.jishnuinfotech.com',
  appBaseUrl: process.env.APP_BASE_URL || process.env.CLIENT_URL || 'https://egates.jishnuinfotech.com',
  attachmentsPath: process.env.ATTACHMENTS_PATH || process.env.UPLOADS_PATH || path.resolve(__dirname, '../../uploads'),

  // Seed super admin credentials
  seedAdmin: {
    username: process.env.SEED_CONSULTANT_USERNAME || process.env.SEED_ADMIN_USERNAME || 'jit_admin',
    password: process.env.SEED_CONSULTANT_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'Jishnuinfotech@123',
    phone: (process.env.SEED_CONSULTANT_CONTACT_NUMBER || process.env.SEED_ADMIN_PHONE || '9566823219').replace(/\s+/g, ''),
  },

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/association_db',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_change_me_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // SMTP Email
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Layout Association <no-reply@association.com>',
  },

  // SMS
  sms: {
    provider: (process.env.SMS_PROVIDER || 'fast2sms').toLowerCase(),
    apiKey: process.env.SMS_API_KEY || '',
    twilioSid: process.env.TWILIO_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhone: process.env.TWILIO_PHONE || '',
  },
};

module.exports = config;
