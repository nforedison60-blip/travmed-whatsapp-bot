// All settings come from environment variables (see .env.example).
const config = {
  port: Number(process.env.PORT) || 3000,
  // "twilio" or "meta" (WhatsApp Cloud API directly)
  provider: (process.env.PROVIDER || 'meta').toLowerCase(),
  // Public address of this bot, e.g. https://travmed-whatsapp-bot1.onrender.com (used to check Twilio signatures)
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_WHATSAPP_FROM || '+14155238886', // Twilio sandbox number by default
  },

  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  appSecret: process.env.META_APP_SECRET || '',
  graphVersion: process.env.GRAPH_API_VERSION || 'v23.0',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  leadsTo: process.env.LEADS_EMAIL_TO || 'info@travmed.co.za',
  leadsFrom: process.env.LEADS_EMAIL_FROM || process.env.SMTP_USER || '',

  // Minutes of silence before a half-finished booking is forgotten.
  sessionTimeoutMin: Number(process.env.SESSION_TIMEOUT_MIN) || 30,
};

function missingConfig() {
  if (config.provider === 'twilio') {
    const required = {
      TWILIO_ACCOUNT_SID: config.twilio.accountSid,
      TWILIO_AUTH_TOKEN: config.twilio.authToken,
      PUBLIC_BASE_URL: config.publicBaseUrl,
    };
    return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  }
  const required = {
    WHATSAPP_VERIFY_TOKEN: config.verifyToken,
    WHATSAPP_ACCESS_TOKEN: config.accessToken,
    WHATSAPP_PHONE_NUMBER_ID: config.phoneNumberId,
  };
  return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
}

module.exports = { config, missingConfig };
