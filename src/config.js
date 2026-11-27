// All settings come from environment variables (see .env.example).
const config = {
  port: Number(process.env.PORT) || 3000,
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
  const required = {
    WHATSAPP_VERIFY_TOKEN: config.verifyToken,
    WHATSAPP_ACCESS_TOKEN: config.accessToken,
    WHATSAPP_PHONE_NUMBER_ID: config.phoneNumberId,
  };
  return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
}

module.exports = { config, missingConfig };
