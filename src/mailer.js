// Emails each completed booking request to TravMed.
const { config } = require('./config');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

function formatLead(lead) {
  return [
    'New booking request via WhatsApp',
    '',
    `Booking:     ${lead.bookingType}`,
    `Area:        ${lead.area}`,
    `Time:        ${lead.time}`,
    '',
    `Name:        ${lead.name}`,
    `Cell (call): ${lead.cell}`,
    `Email:       ${lead.email}`,
    `WhatsApp:    +${lead.whatsapp}  (https://wa.me/${lead.whatsapp})`,
    '',
    'Please call the client from 087 703 3699.',
    '',
    `Received:    ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}`,
  ].join('\n');
}

async function sendLead(lead) {
  const text = formatLead(lead);
  if (!config.smtp.host) {
    console.log('[lead] SMTP not configured. Lead below:\n' + text);
    return;
  }
  await getTransporter().sendMail({
    from: `"TravMed WhatsApp Bot" <${config.leadsFrom}>`,
    to: config.leadsTo,
    replyTo: lead.email || undefined,
    subject: `WhatsApp booking: ${lead.name} – ${lead.bookingType}, ${lead.area} (${lead.time})`,
    text,
  });
}

module.exports = { sendLead, formatLead };
