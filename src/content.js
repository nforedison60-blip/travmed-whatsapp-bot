// ─────────────────────────────────────────────────────────────
// TravMed bot content. Edit this file to change what the bot says.
// WhatsApp limits: button titles ≤ 20 chars, list row titles ≤ 24 chars,
// row descriptions ≤ 72 chars, max 10 list rows, max 3 buttons.
// Customers can tap an option OR type its number (e.g. "3").
// ─────────────────────────────────────────────────────────────

const BUSINESS = {
  name: 'TravMed',
  phone: '087 703 3699',
  email: 'info@travmed.co.za',
};

const BOOKING_TYPES = [
  { id: 'type_checkup', title: 'Medical Check Up' },
  { id: 'type_appointment', title: 'Medical Appointments' },
  { id: 'type_assessment', title: 'Medical Assessments' },
  { id: 'type_report', title: 'Medical Reports' },
];

const AREAS = [
  { id: 'area_jhb', title: 'Johannesburg' },
  { id: 'area_pta', title: 'Pretoria' },
  { id: 'area_dbn', title: 'Durban' },
  { id: 'area_bfn', title: 'Bloemfontein' },
  { id: 'area_gqe', title: 'Gqeberha', description: 'Port Elizabeth', aliases: ['port elizabeth', 'pe'] },
  { id: 'area_plk', title: 'Polokwane' },
  { id: 'area_mbo', title: 'Mbombela', description: 'Nelspruit', aliases: ['nelspruit'] },
  { id: 'area_kim', title: 'Kimberley', aliases: ['kimberly'] },
  { id: 'area_rus', title: 'Rustenburg' },
];

// Shown as 3 tap buttons (WhatsApp allows max 3 buttons, 20 chars each).
const TIME_SLOTS = [
  { id: 'time_1', title: '9am – 11am', label: 'Between 9am to 11am' },
  { id: 'time_2', title: '11am – 2pm', label: 'Between 11am to 2pm' },
  { id: 'time_3', title: '2pm – 5pm', label: 'Between 2pm to 5pm' },
];

const TEXT = {
  welcome:
    'Welcome to TravMed 😊\n\n' +
    'What would you like to book?\n\n' +
    '1. Medical Check Up\n' +
    '2. Medical Appointments\n' +
    '3. Medical Assessments\n' +
    '4. Medical Reports',

  area:
    'Which area do you want to do your assessment:\n\n' +
    '1. Johannesburg\n' +
    '2. Pretoria\n' +
    '3. Durban\n' +
    '4. Bloemfontein\n' +
    '5. Gqeberha (Port Elizabeth)\n' +
    '6. Polokwane\n' +
    '7. Mbombela (Nelspruit)\n' +
    '8. Kimberley\n' +
    '9. Rustenburg',

  cost:
    'Our medical assessments cost *R3 050*\n\n' +
    'You pay to the Doctor when you arrive for the assessment',

  time:
    'What time would you prefer to book?\n\n' +
    '1. Between 9am to 11am\n' +
    '2. Between 11am to 2pm\n' +
    '3. Between 2pm to 5pm',

  details:
    'Thank you 😊\n\n' +
    'Please send the following:\n\n' +
    'Your Name\n' +
    'Your Cell Number (For Calls)\n' +
    'Your email address',

  closing:
    `One of our consultants will call you from our ${BUSINESS.phone} number\n\n` +
    'Have a good day 😊',

  pickFromList: 'Please choose an option from the list, or type its number.',
  submitError:
    `Sorry, something went wrong sending your booking. Please call us on ${BUSINESS.phone} ` +
    `or email ${BUSINESS.email} 🙏`,
};

module.exports = { BUSINESS, BOOKING_TYPES, AREAS, TIME_SLOTS, TEXT };
